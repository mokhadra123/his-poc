import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { ControlUser, Release, ReleaseDetail, ReleaseStatus } from "@his/licence/api";
import { formatLicenceFile } from "@his/licence";
import { audit } from "./audit.ts";
import type { Config } from "./config.ts";
import type { Db } from "./db.ts";
import { conflict, notFound } from "./http.ts";
import { activeLicenceRow, licenceFile } from "./licences.ts";

/*
 * Building an installation's HIS from its licence: scripts/release.mjs in a
 * process of its own, one build at a time, its output kept as the release's
 * log, which is also where its progress and its result are read from.
 * In production this is a CI job the control plane starts; the steps and the
 * bundle are the same.
 */

type Row = {
  id: string;
  installation_id: string;
  customer_id: string;
  licence_id: string;
  status: ReleaseStatus;
  step: string | null;
  version: string | null;
  image: string | null;
  image_id: string | null;
  bundle_file: string | null;
  bundle_sha: string | null;
  bytes: number | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  requester: string;
  label: string;
  connectivity: Release["connectivity"];
  name_en: string;
  name_ar: string;
  products: string;
};

const SELECT = `
  SELECT r.*, u.name AS requester, i.label, i.connectivity, c.name_en, c.name_ar, l.products
  FROM releases r
  JOIN users u ON u.id = r.requested_by
  JOIN installations i ON i.id = r.installation_id
  JOIN customers c ON c.id = r.customer_id
  JOIN licences l ON l.id = r.licence_id`;

function toRelease(r: Row): Release {
  return {
    id: r.id,
    installationId: r.installation_id,
    installationLabel: r.label,
    connectivity: r.connectivity,
    customerId: r.customer_id,
    customerName: { en: r.name_en, ar: r.name_ar },
    licenceId: r.licence_id,
    products: JSON.parse(r.products),
    status: r.status,
    step: r.step,
    version: r.version,
    image: r.image,
    bundle: r.bundle_file ? basename(r.bundle_file) : null,
    bytes: r.bytes,
    error: r.error,
    requestedBy: r.requester,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  };
}

const logFile = (config: Config, id: string) => join(config.releasesDir, `${id}.log`);
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

export function listReleases(db: Db, config: Config, { installationId, customerId }: { installationId?: string; customerId?: string } = {}): Release[] {
  const where: string[] = [];
  const args: string[] = [];
  if (installationId) {
    where.push("r.installation_id = ?");
    args.push(installationId);
  }
  if (customerId) {
    where.push("r.customer_id = ?");
    args.push(customerId);
  }
  settleReleases(db, config);
  const rows = db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.created_at DESC LIMIT 200`).all(...args) as Row[];
  return rows.map(toRelease);
}

function getRow(db: Db, id: string): Row {
  const row = db.prepare(`${SELECT} WHERE r.id = ?`).get(id) as Row | undefined;
  if (!row) throw notFound("Release");
  return row;
}

export function getRelease(db: Db, config: Config, id: string): ReleaseDetail {
  settleReleases(db, config, id);
  const row = getRow(db, id);
  const file = logFile(config, id);
  // the end of the log is what a person reads while it runs, and why it failed; without the
  // terminal colour codes the tools print
  const log = existsSync(file) ? readFileSync(file, "utf8").replace(ANSI, "").split("\n").slice(-400).join("\n") : "";
  return { ...toRelease(row), log };
}

/** The bundle file of a finished release, for the download */
export function releaseBundle(db: Db, id: string): { path: string; name: string; bytes: number } {
  const row = getRow(db, id);
  if (row.status !== "succeeded" || !row.bundle_file || !existsSync(row.bundle_file)) throw notFound("Bundle");
  return { path: row.bundle_file, name: basename(row.bundle_file), bytes: statSync(row.bundle_file).size };
}

type Result = { ok: boolean; error?: string; version?: string; image?: string; imageId?: string; bundleFile?: string; bundleSha?: string; bytes?: number };

const isRunning = (pid: number | null) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/**
 * Brings the running releases up to date from their logs: the step reached,
 * and the end once the build's process is gone (its last line says how it
 * ended). The build is its own process, so a release started before this
 * server restarted still finishes here.
 */
export function settleReleases(db: Db, config: Config, only?: string) {
  const running = db
    .prepare(`SELECT id, pid, requested_by FROM releases WHERE status = 'running' ${only ? "AND id = ?" : ""}`)
    .all(...(only ? [only] : [])) as { id: string; pid: number | null; requested_by: number }[];
  for (const release of running) {
    const file = logFile(config, release.id);
    let step: string | null = null;
    let result: Result | null = null;
    for (const line of existsSync(file) ? readFileSync(file, "utf8").replace(ANSI, "").split("\n") : []) {
      const stepLine = line.match(/^==> (\[\d+\/\d+\] .*)$/);
      if (stepLine) step = stepLine[1];
      if (line.startsWith("RELEASE_RESULT ")) {
        try {
          result = JSON.parse(line.slice("RELEASE_RESULT ".length));
        } catch {
          result = { ok: false, error: "The build's result could not be read" };
        }
      }
    }
    if (step) db.prepare("UPDATE releases SET step = ? WHERE id = ?").run(step, release.id);
    if (isRunning(release.pid)) continue;

    const row = getRow(db, release.id);
    const actor = (db.prepare("SELECT id, email, name, role FROM users WHERE id = ?").get(release.requested_by) as ControlUser | undefined) ?? null;
    const finishedAt = new Date().toISOString();
    if (result?.ok) {
      db.prepare(
        `UPDATE releases SET status = 'succeeded', step = 'Ready', version = ?, image = ?, image_id = ?, bundle_file = ?, bundle_sha = ?, bytes = ?, finished_at = ?
         WHERE id = ?`,
      ).run(result.version ?? null, result.image ?? null, result.imageId ?? null, result.bundleFile ?? null, result.bundleSha ?? null, result.bytes ?? null, finishedAt, release.id);
      audit(db, actor, "release.built", { type: "release", id: release.id }, `Built ${result.version} of ${row.name_en} · ${row.label}`);
    } else {
      const error = result?.error ?? "The build stopped before it finished; the log shows how far it got";
      db.prepare("UPDATE releases SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").run(error, finishedAt, release.id);
      audit(db, actor, "release.failed", { type: "release", id: release.id }, `A release of ${row.name_en} · ${row.label} failed: ${error}`);
    }
  }
}

/** Starts a build of the installation's active licence; answers at once, the build runs on. */
export function startRelease(db: Db, config: Config, actor: ControlUser, installationId: string): Release {
  const installation = db.prepare("SELECT id, customer_id, label, connectivity, retired_at FROM installations WHERE id = ?").get(installationId) as
    | { id: string; customer_id: string; label: string; connectivity: string; retired_at: string | null }
    | undefined;
  if (!installation) throw notFound("Installation");
  if (installation.retired_at) throw conflict("This installation is retired");
  const licence = activeLicenceRow(db, installation.id);
  if (!licence) throw conflict("This installation has no active licence to build from; issue one first");
  // builds share the machine and the verify port: one at a time
  settleReleases(db, config);
  const running = db.prepare("SELECT id FROM releases WHERE status = 'running'").get() as { id: string } | undefined;
  if (running) throw conflict("A release is already being built; wait for it to finish");

  const id = randomUUID();
  mkdirSync(config.releasesDir, { recursive: true });
  const licencePath = join(config.releasesDir, `${id}.licence.json`);
  writeFileSync(licencePath, formatLicenceFile(licenceFile(licence)));
  const scriptArgs = [
    join(config.repoRoot, "scripts/release.mjs"),
    "--licence",
    licencePath,
    "--label",
    installation.label,
    "--out",
    config.releasesDir,
    ...(installation.connectivity === "online" ? ["--online", config.publicUrl] : []),
  ];

  // its own process group writing straight to the log: it outlives a restart of this server
  const file = logFile(config, id);
  writeFileSync(file, `$ node ${scriptArgs.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")}\n`);
  const out = openSync(file, "a");
  const child = spawn(process.execPath, scriptArgs, { cwd: config.repoRoot, detached: true, stdio: ["ignore", out, out] });
  closeSync(out);
  child.unref();

  db.prepare(
    `INSERT INTO releases (id, installation_id, customer_id, licence_id, status, step, pid, requested_by, created_at)
     VALUES (?, ?, ?, ?, 'running', 'Starting', ?, ?, ?)`,
  ).run(id, installation.id, installation.customer_id, licence.id, child.pid ?? null, actor.id, new Date().toISOString());
  audit(db, actor, "release.started", { type: "release", id }, `Started a release of ${licence.name_en} · ${installation.label}`);

  // while this server runs it hears the end at once; after a restart, the timer in main.ts does
  child.on("exit", () => settleReleases(db, config, id));
  child.on("error", (error) => {
    db.prepare("UPDATE releases SET status = 'failed', error = ?, finished_at = coalesce(finished_at, ?) WHERE id = ?").run(
      `The build could not start: ${error.message}`,
      new Date().toISOString(),
      id,
    );
  });
  return toRelease(getRow(db, id));
}
