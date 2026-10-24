/*
 * The runner against stand-ins: a compose that echoes HIS_CUSTOMER (or fails
 * on purpose) and a server that, like `next dev`, forks a worker that holds
 * the port. Free ports only; nothing on 3100 is touched.
 */
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { canConnect, createRunner, type Runner, SHOWCASE_PORT } from "../lib/server/runner.ts";
import { eventually, type Fixture, freePort, makeRepo, REAL_ROOT } from "./fixture.ts";

const FAKE_COMPOSE = `
const id = process.env.HIS_CUSTOMER;
if (id === "slow") await new Promise((r) => setTimeout(r, 600));
if (id === "broken") { console.error("compose: broken on purpose"); process.exit(3); }
console.log(\`composed "\${id}" from HIS_CUSTOMER\`);
`;

const FAKE_SERVER = `
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const [mode, port, pidFile] = process.argv.slice(2);
if (mode === "crash") { console.error("boom: cannot start"); process.exit(4); }
const worker = spawn(process.execPath, ["-e",
  \`require("node:http").createServer((q, s) => s.end("ok")).listen(\${port}, "127.0.0.1"); setInterval(() => {}, 1000)\`],
  { stdio: "inherit" });
writeFileSync(pidFile, String(worker.pid));
process.on("SIGTERM", () => { worker.kill(); process.exit(0); });
setInterval(() => {}, 1000);
`;

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe("runner", () => {
  let repo: Fixture;
  let port: number;
  let mode: "ok" | "crash";
  let runner: Runner;

  beforeEach(async () => {
    repo = makeRepo();
    repo.write("scripts/compose.mjs", FAKE_COMPOSE);
    repo.write("fake-server.mjs", FAKE_SERVER);
    port = await freePort();
    mode = "ok";
    runner = createRunner({
      root: repo.root,
      port,
      server: () => ({
        command: process.execPath,
        args: [join(repo.root, "fake-server.mjs"), mode, String(port), join(repo.root, "worker.pid")],
        cwd: repo.root,
      }),
      readyTimeoutMs: 15_000,
    });
  });
  afterEach(async () => {
    await runner.stop().catch(() => {});
    repo.cleanup();
  });

  it("passes the customer through HIS_CUSTOMER and reports the exit code", async () => {
    const ok = await runner.compose("plain");
    assert.equal(ok.exitCode, 0);
    assert.match(ok.output, /composed "plain" from HIS_CUSTOMER/);
    assert.equal((await runner.status()).last?.ok, true);

    const failed = await runner.compose("broken");
    assert.equal(failed.ok, false);
    assert.equal(failed.exitCode, 3);
    const status = await runner.status();
    assert.equal(status.last?.exitCode, 3);
    assert.match(status.last?.message ?? "", /Compose failed for "broken" \(exit 3\)/);
    assert.ok(status.output.some((line) => line.includes("broken on purpose")));
  });

  it("runs one operation at a time", async () => {
    const first = runner.compose("slow");
    await assert.rejects(runner.compose("plain"), /a compose is in progress/);
    await assert.rejects(runner.start("plain"), /a compose is in progress/);
    assert.equal((await first).exitCode, 0);
    assert.equal((await runner.status()).busy, null);
  });

  it("starts, refuses to recompose while running, and stops the whole process tree", async () => {
    await runner.start("plain");
    const running = await eventually(async () => {
      const s = await runner.status();
      return s.server?.ready ? s : undefined;
    });
    assert.equal(running.server?.url, `http://localhost:${port}`);
    assert.equal(running.busy, null);
    await assert.rejects(runner.compose("other"), /running for "plain"\. Stop it before composing "other"/);
    await assert.rejects(runner.start("plain"), /already running/);

    const worker = Number(repo.read("worker.pid"));
    assert.ok(alive(worker));
    await runner.stop();
    const stopped = await runner.status();
    assert.equal(stopped.server, null);
    assert.deepEqual([stopped.last?.action, stopped.last?.ok], ["stop", true]);
    assert.equal(await canConnect(port), false, "the port is free");
    await eventually(() => (alive(worker) ? undefined : true), 5000);
  });

  it("reports a server that exits while starting", async () => {
    mode = "crash";
    await runner.start("plain");
    const failed = await eventually(async () => {
      const s = await runner.status();
      return s.busy === null ? s : undefined;
    });
    assert.equal(failed.server, null);
    assert.equal(failed.last?.ok, false);
    assert.equal(failed.last?.exitCode, 4);
    assert.match(failed.last?.message ?? "", /exited while starting \(exit 4\)/);
    assert.ok(failed.output.some((line) => line.includes("boom")));
  });

  it("does not start the server when compose fails", async () => {
    await runner.start("broken");
    const status = await runner.status();
    assert.equal(status.server, null);
    assert.equal(status.busy, null);
    assert.match(status.last?.message ?? "", /Compose failed for "broken" \(exit 3\), so the showcase was not started/);
  });

  it("refuses to compose or start while a process it did not start holds the port", async () => {
    const foreign = createServer().listen(port, "127.0.0.1");
    await once(foreign, "listening");
    try {
      assert.equal((await runner.status()).portInUse, true);
      await assert.rejects(runner.start("plain"), /in use by a process this panel did not start/);
      await assert.rejects(runner.compose("plain"), /in use by a process this panel did not start/);
      await assert.rejects(runner.stop(), /No showcase started by this panel/);
    } finally {
      foreign.close();
    }
  });

  it("reports the composed customer's theme, or an older composition's palette flag", async () => {
    const GENERATED = "apps/showcase/products.generated.json";
    assert.equal((await runner.status()).composed, null, "nothing composed yet");
    repo.write(GENERATED, { customer: "two", features: { themePaletteCustomization: true }, theme: { default: "pine", allowed: ["pine", "custom"], brand: "#1f6f8b" } });
    assert.deepEqual((await runner.status()).composed, {
      customerId: "two",
      theme: { default: "pine", allowed: ["pine", "custom"], brand: "#1f6f8b" },
    });
    repo.write(GENERATED, { customer: "old", features: { themePaletteCustomization: true } });
    assert.deepEqual((await runner.status()).composed?.theme?.allowed, ["slate", "ink", "pine", "graphite", "custom", "original"]);
    repo.write(GENERATED, { customer: "older", features: {} });
    assert.deepEqual((await runner.status()).composed?.theme, { default: "slate", allowed: ["slate"], brand: null });
  });

  it("uses the showcase's own dev port", () => {
    const pkg = JSON.parse(readFileSync(join(REAL_ROOT, "apps/showcase/package.json"), "utf8"));
    assert.match(pkg.scripts.dev, new RegExp(`--port ${SHOWCASE_PORT}\\b`));
  });
});
