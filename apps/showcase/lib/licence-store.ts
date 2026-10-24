/*
 * The installation's licence store. Server only, and free of Next imports, so
 * the heartbeat (instrumentation.ts) and the pages share it.
 *
 *   $HIS_LICENCE_DIR (default <cwd>/.licence)
 *     license.json   the installed licence, as the control plane signed it
 *     state.json     what the installation remembers between starts:
 *                    { highWater, instanceId, revokedOn, lastHeartbeat }
 *
 * A licence is checked with the keys the build was composed with
 * (lib/licence.generated.ts), never with a key file lying next to it.
 * Build-time composition is the real protection; this is defense in depth.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  evaluateLicence,
  formatLicenceFile,
  type LicenceEvaluation,
  type LicenceFile,
  type LicencePayload,
} from "@his/licence";
import { verifyLicence } from "@his/licence/server";
import { LICENSING } from "./licence.generated";
import { CUSTOMER } from "./products.generated";

export type HeartbeatRecord = {
  at: string;
  /** the licence server's answer, or "error" when there was none */
  status: "ok" | "renewed" | "revoked" | "unknown" | "error";
  message: string;
};

export type LicenceStoreState = {
  /** the latest time this installation has seen; turning the clock back does not go below it */
  highWater: string;
  /** random id this running copy made for itself on first start (heartbeats) */
  instanceId: string;
  /** the control plane revoked the licence on this day (learned by heartbeat) */
  revokedOn: string | null;
  lastHeartbeat: HeartbeatRecord | null;
};

/** Why an installed (or offered) licence is not accepted. The first four come from verifyLicence. */
export type InvalidCode =
  | "unreadable"
  | "malformed"
  | "unknown-key"
  | "bad-signature"
  | "wrong-customer"
  | "wrong-installation";

export type LicenceCheck =
  /** composed without a licence (a development build): nothing is checked */
  | { licensing: false }
  | { licensing: true; status: "missing" }
  | { licensing: true; status: "invalid"; code: InvalidCode; reason: string; detail?: string }
  | {
      licensing: true;
      status: "ok";
      payload: LicencePayload;
      evaluation: LicenceEvaluation;
      /** licensed, but not composed into this build: needs an updated build */
      notBuilt: string[];
      /** composed into this build, but not on the licence: hidden and answering 404 */
      notLicensed: string[];
    };

export type InstallResult = {
  ok: boolean;
  code: "installed" | "already-installed" | "licensing-off" | "downgrade" | "write-failed" | InvalidCode;
  /** for logs and the heartbeat; the page shows its own words for each code */
  message: string;
  /** a customer or installation id, the refused licence's id, or the shape problems */
  detail?: string;
  payload?: LicencePayload;
};

export const storeDir = () => process.env.HIS_LICENCE_DIR || join(process.cwd(), ".licence");
const licencePath = () => join(storeDir(), "license.json");
const statePath = () => join(storeDir(), "state.json");

/** temp file + rename: a reader never sees half a file */
function writeAtomic(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, path);
}

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/* ---------- state.json ---------- */

/** The installation's state; made (and saved) on first use, so the instance id stays the same. */
export function readState(): LicenceStoreState {
  let raw: Partial<LicenceStoreState> | null = null;
  try {
    raw = JSON.parse(readFileSync(statePath(), "utf8"));
  } catch {
    raw = null;
  }
  const state: LicenceStoreState = {
    highWater: isTime(raw?.highWater) ? raw.highWater : new Date().toISOString(),
    instanceId: typeof raw?.instanceId === "string" && raw.instanceId ? raw.instanceId : randomUUID(),
    revokedOn: isDay(raw?.revokedOn) ? raw.revokedOn : null,
    lastHeartbeat:
      raw?.lastHeartbeat && isTime(raw.lastHeartbeat.at) && typeof raw.lastHeartbeat.status === "string"
        ? raw.lastHeartbeat
        : null,
  };
  if (!raw || raw.highWater !== state.highWater || raw.instanceId !== state.instanceId) saveState(state);
  return state;
}

function saveState(state: LicenceStoreState) {
  try {
    writeAtomic(statePath(), `${JSON.stringify(state, null, 2)}\n`);
  } catch (error) {
    // a read-only disk must not stop the hospital; the check still runs
    console.error(`licence: could not save ${statePath()}: ${(error as Error).message}`);
  }
}

export function updateState(change: (state: LicenceStoreState) => LicenceStoreState) {
  saveState(change(readState()));
  invalidateLicence();
}

/* ---------- checking a licence ---------- */

type Checked = { ok: true; payload: LicencePayload; file: LicenceFile } | { ok: false; code: InvalidCode; reason: string; detail?: string };

function checkText(text: string): Checked {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, code: "unreadable", reason: "The licence file is not JSON" };
  }
  const verified = verifyLicence(file, LICENSING.trustedKeys);
  if (!verified.ok) {
    const shape = verified.code === "malformed" ? verified.reason.replace(/^[^:]*: /, "") : undefined;
    return { ok: false, code: verified.code, reason: verified.reason, detail: shape };
  }
  const { payload } = verified;
  if (payload.customerId !== CUSTOMER.id) {
    return {
      ok: false,
      code: "wrong-customer",
      reason: `The licence is for customer "${payload.customerId}"; this build is for "${CUSTOMER.id}"`,
      detail: payload.customerId,
    };
  }
  // set on an installation that knows its own id; a test copy cannot run on production's licence
  const installation = process.env.HIS_INSTALLATION_ID;
  if (installation && payload.installationId !== installation) {
    return {
      ok: false,
      code: "wrong-installation",
      reason: `The licence is for installation "${payload.installationId}"; this one is "${installation}"`,
      detail: payload.installationId,
    };
  }
  return { ok: true, payload, file: file as LicenceFile };
}

function readInstalled(): { text: string } | { missing: true } | { error: string } {
  try {
    return { text: readFileSync(licencePath(), "utf8") };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { missing: true };
    return { error: (error as Error).message };
  }
}

function evaluateInstalled(): LicenceCheck {
  const installed = readInstalled();
  if ("missing" in installed) return { licensing: true, status: "missing" };
  if ("error" in installed) {
    return { licensing: true, status: "invalid", code: "unreadable", reason: `The licence file cannot be read: ${installed.error}` };
  }
  const checked = checkText(installed.text);
  if (!checked.ok) return { licensing: true, status: "invalid", code: checked.code, reason: checked.reason, detail: checked.detail };

  const { payload } = checked;
  const state = readState();
  const now = new Date();
  const evaluation = evaluateLicence(payload, { now, seen: [state.highWater], revokedOn: state.revokedOn });
  // the high-water mark only moves forward: a clock turned back does not extend a licence
  if (now.getTime() > Date.parse(state.highWater)) saveState({ ...state, highWater: now.toISOString() });

  return {
    licensing: true,
    status: "ok",
    payload,
    evaluation,
    notBuilt: payload.products.filter((id) => !LICENSING.builtProducts.includes(id)),
    notLicensed: LICENSING.builtProducts.filter((id) => !payload.products.includes(id)),
  };
}

/* ---------- the check, cached ---------- */

// Kept on globalThis: Next bundles instrumentation.ts, pages and server
// actions separately, and an install from any of them must reach all of them.
const CACHE = Symbol.for("his.licence.check");
const CACHE_MS = 30_000;
type Cached = { at: number; mtime: number; check: LicenceCheck };
const cache = globalThis as unknown as Record<symbol, Cached | undefined>;

const mtimeOf = (path: string) => {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return -1;
  }
};

/** Where the installed licence stands. Re-read every 30 s, or as soon as license.json changes. */
export function getLicence(): LicenceCheck {
  if (!LICENSING.enabled) return { licensing: false };
  const mtime = mtimeOf(licencePath());
  const hit = cache[CACHE];
  if (hit && hit.mtime === mtime && Date.now() - hit.at < CACHE_MS) return hit.check;
  const check = evaluateInstalled();
  cache[CACHE] = { at: Date.now(), mtime, check };
  return check;
}

export function invalidateLicence() {
  cache[CACHE] = undefined;
}

/* ---------- installing a renewal ---------- */

/**
 * Install a licence file (the licence page's upload, or a heartbeat's renewal).
 * Checked first; an older licence is refused — unless the licence server sent
 * it (`fromLicenceServer`): revoking a renewal there makes the licence it
 * replaced current again, and the heartbeat hands that one back.
 */
export function installLicence(fileText: string, { fromLicenceServer = false }: { fromLicenceServer?: boolean } = {}): InstallResult {
  if (!LICENSING.enabled) {
    return { ok: false, code: "licensing-off", message: "This build was composed without a licence; there is nothing to install it into" };
  }
  const checked = checkText(fileText);
  if (!checked.ok) return { ok: false, code: checked.code, message: checked.reason, detail: checked.detail };
  const next = checked.payload;

  // the licence installed now: verified when possible, otherwise just its id
  const installed = readInstalled();
  let current: LicencePayload | null = null;
  let currentId: string | null = null;
  if ("text" in installed) {
    const old = checkText(installed.text);
    if (old.ok) current = old.payload;
    try {
      const id = JSON.parse(installed.text)?.payload?.licenceId;
      currentId = typeof id === "string" ? id : null;
    } catch {
      currentId = null;
    }
  }
  if (current?.licenceId === next.licenceId && current.issuedAt === next.issuedAt) {
    return { ok: true, code: "already-installed", message: `Licence ${next.licenceId} is already installed`, detail: next.licenceId, payload: next };
  }
  if (current && !fromLicenceServer && Date.parse(next.issuedAt) < Date.parse(current.issuedAt)) {
    return {
      ok: false,
      code: "downgrade",
      message: `Licence ${next.licenceId} (issued ${next.issuedAt}) is older than the installed ${current.licenceId} (issued ${current.issuedAt})`,
      detail: next.licenceId,
    };
  }

  try {
    writeAtomic(licencePath(), formatLicenceFile(checked.file));
  } catch (error) {
    return { ok: false, code: "write-failed", message: `The licence could not be saved: ${(error as Error).message}` };
  }
  // a revocation belongs to the licence it was learned for
  if (currentId !== next.licenceId) updateState((s) => ({ ...s, revokedOn: null }));
  invalidateLicence();
  return {
    ok: true,
    code: "installed",
    message: `Installed licence ${next.licenceId} (last valid day ${next.expiresOn})`,
    detail: next.licenceId,
    payload: next,
  };
}
