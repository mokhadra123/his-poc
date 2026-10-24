import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { addDays, dayOf } from "@his/licence";
import { verifyLicence } from "@his/licence/server";
import { createApp } from "../src/app.ts";
import { createUser } from "../src/auth.ts";
import { readConfig } from "../src/config.ts";
import { openDb } from "../src/db.ts";
import { settleReleases } from "../src/releases.ts";
import { prepare } from "../src/setup.ts";

/* The whole API against a throwaway repository: it writes customers/<id> and trusted-keys.json. */

const tmp = mkdtempSync(join(tmpdir(), "his-control-"));
const repo = join(tmp, "repo");
const write = (file: string, value: unknown) => {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
};
write(join(repo, "scripts/compose.mjs"), "");
// stands in for the real build (next build, docker): reports two steps and a result, as scripts/release.mjs does;
// a licence with pharmacy fails, so both endings can be seen
write(
  join(repo, "scripts/release.mjs"),
  `import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const opt = (name) => args[args.indexOf(name) + 1];
const licence = JSON.parse(readFileSync(opt("--licence"), "utf8"));
console.log("==> [1/8] Copying the repository");
await new Promise((done) => setTimeout(done, 300));
if (licence.payload.products.includes("pharmacy")) {
  console.log("RELEASE_RESULT " + JSON.stringify({ ok: false, error: "Step 1 of 8 failed: no pharmacy here." }));
  process.exit(1);
}
console.log("\\u001b[32m==> [8/8] Packing the bundle into one file\\u001b[39m");
const bundleFile = opt("--out") + "/his-test-1.0.0.tar.gz";
writeFileSync(bundleFile, "the bundle");
console.log("RELEASE_RESULT " + JSON.stringify({ ok: true, version: "1.0.0", image: "his/test:1.0.0", imageId: "sha256:1", bundleFile, bundleSha: "x", bytes: 10 }));
`,
);
for (const id of ["billing", "pharmacy"]) {
  write(join(repo, `packages/${id}/his.product.json`), {
    id,
    package: `@his/${id}`,
    name: { en: id, ar: id },
    routes: [{ path: `${id}/x` }],
  });
}
write(join(repo, "customers/al-amal/customer.json"), { id: "al-amal", name: { en: "Al-Amal Hospital", ar: "مستشفى الأمل" }, products: [] });
write(join(repo, "customers/all/customer.json"), { id: "all", name: { en: "All", ar: "الكل" }, products: "*" });

const config = readConfig({ HIS_REPO_ROOT: repo, CONTROL_DATA_DIR: join(tmp, "data"), CONTROL_OWNER_PASSWORD: "owner-password-1" });
const db = openDb(":memory:");
let base = "";
let close = () => {};

async function call(method: string, path: string, { token, body }: { token?: string; body?: unknown } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text.startsWith("{") ? JSON.parse(text) : text };
}

async function signIn(email: string, password: string) {
  const r = await call("POST", "/api/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.data.token as string;
}

before(async () => {
  prepare(db, config);
  createUser(db, { email: "viewer@his.local", name: "Viewer", role: "viewer", password: "viewer-password-1" });
  const server = createApp(db, config).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
after(() => {
  close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("licence server", () => {
  let owner = "";
  let installationId = "";
  let firstLicence = "";

  it("prepares: catalog, published keys, imported customers (not the dev 'all')", async () => {
    owner = await signIn("owner@his.local", "owner-password-1");
    const catalog = await call("GET", "/api/catalog", { token: owner });
    assert.deepEqual(catalog.body.data.map((p: { id: string }) => p.id).sort(), ["billing", "pharmacy"]);
    const keys = JSON.parse(readFileSync(config.trustedKeysFile, "utf8"));
    assert.equal(keys.keys.length, 1);
    const customers = await call("GET", "/api/customers", { token: owner });
    assert.deepEqual(customers.body.data.map((c: { id: string }) => c.id), ["al-amal"]);
  });

  it("refuses without a session, and refuses wrong passwords alike", async () => {
    assert.equal((await call("GET", "/api/customers")).status, 401);
    const wrong = await call("POST", "/api/auth/login", { body: { email: "owner@his.local", password: "nope" } });
    const unknown = await call("POST", "/api/auth/login", { body: { email: "nobody@his.local", password: "nope" } });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  it("creates a customer and its customers/<id> folder for compose", async () => {
    const r = await call("POST", "/api/customers", {
      token: owner,
      body: { id: "al-noor", name: { en: "Al-Noor Clinic", ar: "عيادة النور" }, contactEmail: "it@al-noor.example" },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.ok(existsSync(join(repo, "customers/al-noor/customer.json")));
    const bad = await call("POST", "/api/customers", { token: owner, body: { id: "Bad Id", name: { en: "", ar: "x" } } });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.error.details.map((d: { field: string }) => d.field).sort(), ["id", "name.en"]);
  });

  it("sets a customer's themes and writes them where compose reads them", async () => {
    write(join(repo, "customers/al-amal/customer.json"), {
      id: "al-amal",
      name: { en: "Al-Amal Hospital", ar: "مستشفى الأمل" },
      products: [],
      features: { themePaletteCustomization: true },
      extensions: { routes: [] },
    });
    // before any setting: the old switch, read as compose reads it
    const before = (await call("GET", "/api/customers/al-amal", { token: owner })).body.data.theme;
    assert.equal(before.allowed.length, 6);
    const r = await call("PUT", "/api/customers/al-amal/theme", {
      token: owner,
      body: { allowed: ["pine", "custom"], default: "pine", brand: "#1F6F8B" },
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.data.theme, { default: "pine", allowed: ["pine", "custom"], brand: "#1f6f8b" });
    const file = JSON.parse(readFileSync(join(repo, "customers/al-amal/customer.json"), "utf8"));
    assert.deepEqual(file.theme, { default: "pine", allowed: ["pine", "custom"], brand: "#1f6f8b" });
    assert.equal(file.features, undefined, "the old switch is dropped");
    assert.deepEqual(file.extensions, { routes: [] }, "other keys are kept");
    // a brand without the custom theme is meaningless: dropped
    const noCustom = await call("PUT", "/api/customers/al-amal/theme", {
      token: owner,
      body: { allowed: ["slate"], default: "slate", brand: "#1f6f8b" },
    });
    assert.equal(noCustom.body.data.theme.brand, null);
    for (const body of [
      { allowed: ["pine"], default: "slate" },
      { allowed: [], default: "slate" },
      { allowed: ["neon"], default: "neon" },
      { allowed: ["custom"], default: "custom", brand: "blue" },
    ]) {
      assert.equal((await call("PUT", "/api/customers/al-amal/theme", { token: owner, body })).status, 400, JSON.stringify(body));
    }
  });

  it("a viewer can read but not change", async () => {
    const viewer = await signIn("viewer@his.local", "viewer-password-1");
    assert.equal((await call("GET", "/api/customers", { token: viewer })).status, 200);
    const r = await call("POST", "/api/customers/al-amal/installations", {
      token: viewer,
      body: { label: "x", environment: "test", connectivity: "offline" },
    });
    assert.equal(r.status, 403);
  });

  it("issues a licence whose file verifies with the published keys", async () => {
    const inst = await call("POST", "/api/customers/al-amal/installations", {
      token: owner,
      body: { label: "Main hospital", environment: "production", connectivity: "online" },
    });
    assert.equal(inst.status, 201);
    installationId = inst.body.data.id;
    const expiresOn = addDays(dayOf(new Date()), 10);
    const issued = await call("POST", "/api/licences", {
      token: owner,
      body: { installationId, products: ["billing"], expiresOn, warnDays: 30, graceDays: 14 },
    });
    assert.equal(issued.status, 201, JSON.stringify(issued.body));
    firstLicence = issued.body.data.id;
    assert.equal(issued.body.data.display, "warning");
    const file = await call("GET", `/api/licences/${firstLicence}/file`, { token: owner });
    const trusted = JSON.parse(readFileSync(config.trustedKeysFile, "utf8"));
    const verified = verifyLicence(file.body, trusted);
    assert.equal(verified.ok, true);
    assert.equal(verified.ok && verified.payload.customerId, "al-amal");
  });

  it("refuses unknown products and past dates", async () => {
    const r = await call("POST", "/api/licences", {
      token: owner,
      body: { installationId, products: ["radiology"], expiresOn: "2099-01-01", warnDays: 30, graceDays: 14 },
    });
    assert.equal(r.body.error.code, "UNKNOWN_PRODUCT");
    const past = await call("POST", "/api/licences", {
      token: owner,
      body: { installationId, products: [], expiresOn: "2001-01-01", warnDays: 30, graceDays: 14 },
    });
    assert.equal(past.body.error.code, "EXPIRES_IN_PAST");
  });

  it("heartbeat: ok, then renewed after a new licence, and counts running copies", async () => {
    const beat = (licenceId: string, instanceId = "instance-aaaa") =>
      call("POST", "/api/v1/heartbeat", { body: { installationId, licenceId, instanceId, version: "0.1.0", state: "warning" } });
    assert.equal((await beat(firstLicence)).body.data.status, "ok");
    const renewed = await call("POST", "/api/licences", {
      token: owner,
      body: { installationId, products: ["billing", "pharmacy"], expiresOn: "2099-12-31", warnDays: 30, graceDays: 14 },
    });
    assert.equal(renewed.body.data.supersedes, firstLicence);
    const answer = (await beat(firstLicence)).body.data;
    assert.equal(answer.status, "renewed");
    assert.equal(answer.licence.payload.licenceId, renewed.body.data.id);
    await beat(renewed.body.data.id, "instance-bbbb");
    const overview = await call("GET", "/api/overview", { token: owner });
    assert.ok(overview.body.data.attention.some((a: { kind: string }) => a.kind === "duplicate"));
  });

  it("revoking a renewal makes the licence it replaced current again", async () => {
    const renewal = (await call("GET", `/api/installations/${installationId}`, { token: owner })).body.data.licence;
    assert.equal(renewal.supersedes, firstLicence);
    const r = await call("POST", `/api/licences/${renewal.id}/revoke`, { token: owner, body: { reason: "Issued by mistake" } });
    assert.equal(r.body.data.display, "revoked");
    assert.match(r.body.meta.message, /active again/);
    const restored = (await call("GET", `/api/licences/${firstLicence}`, { token: owner })).body.data;
    assert.equal(restored.status, "active");
    assert.equal(restored.supersededBy, null);
    const beat = (licenceId: string) =>
      call("POST", "/api/v1/heartbeat", { body: { installationId, licenceId, instanceId: "instance-aaaa" } }).then((x) => x.body.data);
    // a site still on the paid licence is fine; one that installed the mistake gets the paid one back
    assert.equal((await beat(firstLicence)).status, "ok");
    const back = await beat(renewal.id);
    assert.equal(back.status, "renewed");
    assert.equal(back.licence.payload.licenceId, firstLicence);
  });

  it("heartbeat: revoked, with the day", async () => {
    const r = await call("POST", `/api/licences/${firstLicence}/revoke`, { token: owner, body: { reason: "Contract ended" } });
    assert.equal(r.body.data.display, "revoked");
    const answer = (
      await call("POST", "/api/v1/heartbeat", { body: { installationId, licenceId: firstLicence, instanceId: "instance-aaaa" } })
    ).body.data;
    assert.equal(answer.status, "revoked");
    assert.equal(answer.revokedOn, dayOf(new Date()));
  });

  it("retiring revokes the licence and retires in one step, without restoring older ones", async () => {
    const inst = (
      await call("POST", "/api/customers/al-amal/installations", {
        token: owner,
        body: { label: "Second site", environment: "production", connectivity: "online" },
      })
    ).body.data.id;
    const issue = (products: string[]) =>
      call("POST", "/api/licences", {
        token: owner,
        body: { installationId: inst, products, expiresOn: "2099-12-31", warnDays: 30, graceDays: 14 },
      }).then((x) => x.body.data);
    const a = await issue(["billing"]);
    const b = await issue(["billing", "pharmacy"]);
    const retired = await call("POST", `/api/installations/${inst}/retire`, { token: owner });
    assert.ok(retired.body.data.retiredAt);
    assert.equal((await call("GET", `/api/licences/${b.id}`, { token: owner })).body.data.status, "revoked");
    assert.equal((await call("GET", `/api/licences/${a.id}`, { token: owner })).body.data.status, "superseded");
    const answer = (await call("POST", "/api/v1/heartbeat", { body: { installationId: inst, licenceId: a.id, instanceId: "instance-cccc" } }))
      .body.data;
    assert.equal(answer.status, "revoked");
  });

  it("refuses reserved customer ids and days that do not exist", async () => {
    const all = await call("POST", "/api/customers", { token: owner, body: { id: "all", name: { en: "All", ar: "الكل" } } });
    assert.equal(all.status, 400);
    assert.equal(all.body.error.details[0].field, "id");
    for (const expiresOn of ["2027-02-30", "2027-13-01", "2026-02-29"]) {
      const r = await call("POST", "/api/licences", {
        token: owner,
        body: { installationId, products: [], expiresOn, warnDays: 30, graceDays: 14 },
      });
      assert.equal(r.status, 400, `${expiresOn} → ${r.status}`);
    }
  });

  it("a viewer may not download licence files; a bad audit limit is not a 500", async () => {
    const viewer = await signIn("viewer@his.local", "viewer-password-1");
    assert.equal((await call("GET", `/api/licences/${firstLicence}/file`, { token: viewer })).status, 403);
    assert.equal((await call("GET", "/api/audit?limit=abc", { token: viewer })).status, 200);
  });

  it("slows down a guesser per e-mail, without a long lock-out", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push((await call("POST", "/api/auth/login", { body: { email: "viewer@his.local", password: `guess-${i}` } })).status);
    }
    assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
    assert.equal(statuses[5], 429);
  });

  it("heartbeat: unknown for a licence of another installation", async () => {
    const answer = (await call("POST", "/api/v1/heartbeat", { body: { installationId: "nope", licenceId: firstLicence, instanceId: "instance-aaaa" } }))
      .body.data;
    assert.equal(answer.status, "unknown");
  });

  it("rotating keeps old licences verifiable", async () => {
    const r = await call("POST", "/api/keys/rotate", { token: owner });
    assert.equal(r.body.data.length, 2);
    const trusted = JSON.parse(readFileSync(config.trustedKeysFile, "utf8"));
    const file = await call("GET", `/api/licences/${firstLicence}/file`, { token: owner });
    assert.equal(verifyLicence(file.body, trusted).ok, true);
  });

  it("keeps an audit trail", async () => {
    const audit = await call("GET", "/api/audit?customerId=al-amal", { token: owner });
    const actions = audit.body.data.map((a: { action: string }) => a.action);
    for (const action of ["installation.created", "licence.issued", "licence.renewed", "licence.revoked"]) {
      assert.ok(actions.includes(action), `${action} missing from ${actions.join(", ")}`);
    }
  });
});

describe("releases", () => {
  let owner = "";
  let installationId = "";
  let licenceId = "";
  let releaseId = "";

  const newInstallation = async (connectivity: "online" | "offline", products: string[]) => {
    const inst = await call("POST", "/api/customers/al-amal/installations", {
      token: owner,
      body: { label: `Release ${connectivity} ${products.join("+")}`, environment: "test", connectivity },
    });
    const id = inst.body.data.id as string;
    const issued = await call("POST", "/api/licences", {
      token: owner,
      body: { installationId: id, products, expiresOn: "2099-12-31", warnDays: 30, graceDays: 14 },
    });
    return { id, licenceId: issued.body.data.id as string };
  };
  const finished = async (id: string) => {
    for (let i = 0; i < 100; i++) {
      const r = await call("GET", `/api/releases/${id}`, { token: owner });
      if (r.body.data.status !== "running") return r.body.data;
      await new Promise((done) => setTimeout(done, 50));
    }
    throw new Error(`release ${id} never finished`);
  };

  it("refuses an installation with no licence to build from", async () => {
    owner = await signIn("owner@his.local", "owner-password-1");
    const bare = await call("POST", "/api/customers/al-amal/installations", {
      token: owner,
      body: { label: "No licence yet", environment: "test", connectivity: "offline" },
    });
    assert.equal((await call("POST", `/api/installations/${bare.body.data.id}/releases`, { token: owner })).status, 409);
  });

  it("builds from the active licence, one at a time, and serves the bundle to issuers only", async () => {
    ({ id: installationId, licenceId } = await newInstallation("online", ["billing"]));
    const started = await call("POST", `/api/installations/${installationId}/releases`, { token: owner });
    assert.equal(started.status, 202, JSON.stringify(started.body));
    releaseId = started.body.data.id;
    assert.equal(started.body.data.status, "running");
    assert.equal(started.body.data.licenceId, licenceId);
    assert.equal((await call("POST", `/api/installations/${installationId}/releases`, { token: owner })).status, 409);

    const release = await finished(releaseId);
    assert.equal(release.status, "succeeded", release.log);
    assert.equal(release.step, "Ready");
    assert.equal(release.version, "1.0.0");
    assert.equal(release.bundle, "his-test-1.0.0.tar.gz");
    // an online installation's bundle is told where to report; the log reads without colour codes
    assert.match(release.log, /--online http:\/\/host\.docker\.internal:4300/);
    assert.match(release.log, /^==> \[8\/8\] Packing the bundle into one file$/m);

    const bundle = await fetch(`${base}/api/releases/${releaseId}/bundle`, { headers: { authorization: `Bearer ${owner}` } });
    assert.equal(bundle.status, 200);
    assert.equal(await bundle.text(), "the bundle");
    createUser(db, { email: "release-viewer@his.local", name: "Release viewer", role: "viewer", password: "viewer-password-2" });
    const viewer = await signIn("release-viewer@his.local", "viewer-password-2");
    assert.equal((await call("GET", `/api/releases/${releaseId}`, { token: viewer })).status, 200);
    assert.equal((await call("GET", `/api/releases/${releaseId}/bundle`, { token: viewer })).status, 403);
    assert.equal((await call("POST", `/api/installations/${installationId}/releases`, { token: viewer })).status, 403);

    const listed = await call("GET", "/api/releases?customerId=al-amal", { token: owner });
    assert.ok(listed.body.data.some((r: { id: string }) => r.id === releaseId));
  });

  it("a failed build keeps the reason and has no bundle", async () => {
    const { id } = await newInstallation("offline", ["billing", "pharmacy"]);
    const started = await call("POST", `/api/installations/${id}/releases`, { token: owner });
    const release = await finished(started.body.data.id);
    assert.equal(release.status, "failed");
    assert.equal(release.error, "Step 1 of 8 failed: no pharmacy here.");
    assert.doesNotMatch(release.log, /--online/);
    assert.equal((await call("GET", `/api/releases/${release.id}/bundle`, { token: owner })).status, 404);
  });

  it("a build outlives a restart: it is settled from its log once its process is gone", () => {
    const gone = spawnSync(process.execPath, ["-e", ""]).pid;
    const row = (id: string, pid: number, log: string) => {
      db.prepare(
        `INSERT INTO releases (id, installation_id, customer_id, licence_id, status, step, pid, requested_by, created_at)
         VALUES (?, ?, 'al-amal', ?, 'running', 'Starting', ?, 1, ?)`,
      ).run(id, installationId, licenceId, pid, new Date().toISOString());
      write(join(config.releasesDir, `${id}.log`), log);
    };
    const result = { ok: true, version: "1.0.1", image: "his/test:1.0.1", imageId: "sha256:2", bundleFile: "/nowhere.tar.gz", bundleSha: "y", bytes: 1 };
    row("after-restart-done", gone, `==> [8/8] Packing\nRELEASE_RESULT ${JSON.stringify(result)}\n`);
    row("after-restart-killed", gone, "==> [3/8] Building the standalone app\n");
    row("still-running", process.pid, "==> [5/8] Building the image\n");
    settleReleases(db, config);
    const status = (id: string) => db.prepare("SELECT status, step, error FROM releases WHERE id = ?").get(id) as { status: string; step: string; error: string | null };
    assert.equal(status("after-restart-done").status, "succeeded");
    assert.equal(status("after-restart-killed").status, "failed");
    assert.match(status("after-restart-killed").error ?? "", /stopped before it finished/);
    assert.deepEqual({ ...status("still-running") }, { status: "running", step: "[5/8] Building the image", error: null });
    db.prepare("UPDATE releases SET status = 'failed' WHERE id = 'still-running'").run();
  });
});
