/*
 * Compose and run the showcase, one thing at a time.
 *
 * compose.mjs rewrites apps/showcase in place and the showcase's next.config
 * reads the result only when it starts, so there is one composition and at
 * most one showcase server. Compose and start are refused while a server
 * runs (stop it first) or while something the panel did not start holds the
 * showcase port. The panel only ever stops the process it started itself.
 */
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";
import type { RunAction, RunStatus } from "../types.ts";
import { childEnv, type ComposeResult, runCompose } from "./compose.ts";
import { findRepoRoot, isRecord, PanelError } from "./repo.ts";
import { readTheme } from "./theme.ts";

/** The showcase's dev port — `next dev --port 3100` in apps/showcase/package.json */
export const SHOWCASE_PORT = 3100;

type Command = { command: string; args: string[]; cwd: string };

export type RunnerOptions = {
  root: string;
  port: number;
  /** how the showcase server is started; tests pass a stand-in */
  server: () => Command;
  readyTimeoutMs: number;
};

/** `node <next cli> dev` in apps/showcase: a known file, fixed arguments, no shell. */
export function showcaseServer(root: string): Command {
  const cwd = join(root, "apps", "showcase");
  const cli = [join(cwd, "node_modules/next/dist/bin/next"), join(root, "node_modules/next/dist/bin/next")].find((f) =>
    existsSync(f),
  );
  if (!cli) throw new PanelError("Next.js is not installed (node_modules/next/dist/bin/next). Run npm install.");
  return { command: process.execPath, args: [cli, "dev", "--port", String(SHOWCASE_PORT), "--hostname", "127.0.0.1"], cwd };
}

type Server = { customerId: string; child: ChildProcess; url: string; ready: boolean; stopping: boolean; exited: boolean };

const MAX_LINES = 300;
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

export function createRunner(options: RunnerOptions) {
  const { root, port } = options;
  let busy: RunAction | null = null;
  let server: Server | null = null;
  let output: string[] = [];
  let last: RunStatus["last"] = null;

  const log = (text: string) => {
    for (const line of text.replace(ANSI, "").split(/\r?\n/)) if (line.trim()) output.push(line.slice(0, 1000));
    if (output.length > MAX_LINES) output = output.slice(-MAX_LINES);
  };
  const record = (action: RunAction, customerId: string, ok: boolean, exitCode: number | null, message: string) => {
    last = { action, customerId, ok, exitCode, message, at: new Date().toISOString() };
    log(`${ok ? "✓" : "✗"} ${message}`);
  };

  /** The lock: set synchronously, so a second request can never slip in between. */
  const claim = (action: RunAction) => {
    if (busy) throw new PanelError(`Wait — ${busy === "compose" ? "a compose" : busy === "start" ? "a start" : "a stop"} is in progress`);
    busy = action;
  };

  /** Nothing else may be using the composed output. */
  const ensureFree = async (customerId: string) => {
    if (server) {
      throw new PanelError(
        server.customerId === customerId
          ? `The showcase for "${customerId}" is already running. Stop it to compose again.`
          : `The showcase is running for "${server.customerId}". Stop it before composing "${customerId}".`,
      );
    }
    if (await canConnect(port)) {
      throw new PanelError(
        `Port ${port} is in use by a process this panel did not start (a terminal \`npm run dev\`, or a showcase ` +
          `left by an earlier panel session). Stop that process first — the panel will not stop it for you.`,
      );
    }
  };

  async function compose(customerId: string): Promise<ComposeResult> {
    claim("compose");
    try {
      await ensureFree(customerId);
      output = [];
      const result = await runCompose(root, customerId, [], { onOutput: log });
      record("compose", customerId, result.ok, result.exitCode, result.ok
        ? `Composed "${customerId}"`
        : `Compose failed for "${customerId}" (exit ${result.exitCode ?? "none"})`);
      return result;
    } finally {
      busy = null;
    }
  }

  /**
   * Compose, then start the showcase. Returns the compose result once the
   * server is launched (or compose failed); it becomes ready in the background.
   */
  async function start(customerId: string): Promise<ComposeResult> {
    claim("start");
    let launched = false;
    try {
      await ensureFree(customerId);
      output = [];
      const result = await runCompose(root, customerId, [], { onOutput: log });
      if (!result.ok) {
        record("start", customerId, false, result.exitCode, `Compose failed for "${customerId}" (exit ${result.exitCode ?? "none"}), so the showcase was not started`);
        return result;
      }
      const { command, args, cwd } = options.server();
      log(`Starting the showcase for "${customerId}" on port ${port}…`);
      // not detached, same console: Ctrl+C in the panel's terminal reaches it too
      const child = spawn(command, args, { cwd, env: childEnv({ HIS_CUSTOMER: customerId }), stdio: ["ignore", "pipe", "pipe"] });
      const current: Server = { customerId, child, url: `http://localhost:${port}`, ready: false, stopping: false, exited: false };
      server = current;
      child.stdout?.on("data", (chunk: Buffer) => log(chunk.toString()));
      child.stderr?.on("data", (chunk: Buffer) => log(chunk.toString()));
      child.on("error", (error) => log(`The showcase could not be started: ${error.message}`));
      child.once("close", (code, signal) => exited(current, code, signal));
      launched = true;
      void waitUntilReady(current);
      return result;
    } finally {
      if (!launched) busy = null;
    }
  }

  async function waitUntilReady(current: Server) {
    const deadline = Date.now() + options.readyTimeoutMs;
    while (!current.stopping && !current.exited) {
      if (await canConnect(port)) {
        if (current.stopping || current.exited) return;
        current.ready = true;
        busy = null;
        record("start", current.customerId, true, null, `The showcase for "${current.customerId}" is running at ${current.url}`);
        return;
      }
      if (Date.now() > deadline) {
        await terminate(current);
        record("start", current.customerId, false, null, `The showcase did not open port ${port} within ${options.readyTimeoutMs / 1000} s and was stopped`);
        busy = null;
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  function exited(current: Server, code: number | null, signal: NodeJS.Signals | null) {
    current.exited = true;
    if (server === current) server = null;
    if (current.stopping) return;
    const how = code !== null ? `exit ${code}` : `signal ${signal ?? "none"}`;
    if (!current.ready) {
      busy = null;
      record("start", current.customerId, false, code, `The showcase for "${current.customerId}" exited while starting (${how})`);
    } else {
      record("start", current.customerId, false, code, `The showcase for "${current.customerId}" stopped unexpectedly (${how})`);
    }
  }

  /** Stop the process this panel started (and the server it forked) and wait for it to exit. */
  async function terminate(current: Server) {
    current.stopping = true;
    if (current.exited) return;
    const gone = new Promise<void>((r) => current.child.once("close", () => r()));
    killTree(current.child);
    const timeout = (ms: number) => new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms));
    if ((await Promise.race([gone, timeout(5000)])) === "timeout") {
      current.child.kill("SIGKILL");
      if ((await Promise.race([gone, timeout(5000)])) === "timeout") log(`The showcase (pid ${current.child.pid}) did not exit`);
    }
    if (server === current) server = null;
  }

  async function stop(): Promise<void> {
    const current = server;
    if (!current) throw new PanelError("No showcase started by this panel is running");
    if (busy === "stop" || busy === "compose") throw new PanelError(`Wait — a ${busy} is in progress`);
    // allowed while starting: that cancels the start
    busy = "stop";
    try {
      log(`Stopping the showcase for "${current.customerId}"…`);
      await terminate(current);
      record("stop", current.customerId, true, null, `Stopped the showcase for "${current.customerId}"`);
    } finally {
      busy = null;
    }
  }

  async function status(): Promise<RunStatus> {
    return {
      busy,
      server: server && { customerId: server.customerId, url: server.url, ready: server.ready },
      composed: readComposed(root),
      portInUse: server ? false : await canConnect(port),
      port,
      last,
      output: [...output],
    };
  }

  // the panel exiting takes its showcase along
  process.once("exit", () => {
    if (server && !server.exited) killTree(server.child);
  });

  return { compose, start, stop, status };
}

export type Runner = ReturnType<typeof createRunner>;

/**
 * Only ever a process this panel spawned, through its live handle. On Windows
 * `taskkill /T` takes the server `next dev` forked as well (a plain kill would
 * leave it holding the port); elsewhere next dev passes SIGTERM on itself.
 */
function killTree(child: ChildProcess) {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    const taskkill = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}

/** Does something accept connections on the port? */
export function canConnect(port: number, host = "127.0.0.1", timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host });
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

/** What apps/showcase is composed for right now: its "theme", or an older composition's palette flag. */
function readComposed(root: string): RunStatus["composed"] {
  try {
    const record: unknown = JSON.parse(readFileSync(join(root, "apps/showcase/products.generated.json"), "utf8"));
    if (!isRecord(record) || typeof record.customer !== "string") return null;
    const theme = readTheme(record);
    return { customerId: record.customer, theme: typeof theme === "string" ? null : theme.theme };
  } catch {
    return null;
  }
}

/** The panel's runner. Kept on globalThis: route modules and hot reloads must share one. */
export function getRunner(): Runner {
  const store = globalThis as typeof globalThis & { __hisCustomerPanelRunner?: Runner };
  if (!store.__hisCustomerPanelRunner) {
    const root = findRepoRoot();
    store.__hisCustomerPanelRunner = createRunner({
      root,
      port: SHOWCASE_PORT,
      server: () => showcaseServer(root),
      readyTimeoutMs: 120_000,
    });
  }
  return store.__hisCustomerPanelRunner;
}
