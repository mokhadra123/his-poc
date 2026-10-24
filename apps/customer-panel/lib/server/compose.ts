/*
 * Runs scripts/compose.mjs — the one place that knows how to compose a
 * customer. Always `node <repo>/scripts/compose.mjs` with fixed flags: no
 * shell, nothing the browser typed on the command line. The customer goes in
 * through HIS_CUSTOMER in the child's environment, so it works the same on
 * Windows.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCustomerId, PanelError } from "./repo.ts";

export type ComposeResult = { ok: boolean; exitCode: number | null; output: string };

// set by the panel's own Next.js process; a child `next dev` would take them as its own
const INTERNAL = /^(__NEXT|NEXT_PRIVATE|NEXT_RUNTIME|__TURBOPACK|TURBOPACK)/i;
const DROPPED = new Set(["PORT", "NODE_ENV", "NODE_OPTIONS", "HIS_CUSTOMER"]);

/** The environment for a process the panel starts. */
export function childEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!INTERNAL.test(key) && !DROPPED.has(key.toUpperCase())) env[key] = value;
  }
  // compose and `next dev` run as development, whatever the panel itself runs as
  return { ...env, ...extra, NODE_ENV: "development" as const };
}

export function runCompose(
  root: string,
  customerId: string,
  flags: string[] = [],
  { timeoutMs = 60_000, onOutput }: { timeoutMs?: number; onOutput?: (text: string) => void } = {},
): Promise<ComposeResult> {
  const invalid = checkCustomerId(customerId);
  if (invalid) throw new PanelError(invalid);
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    const settle = (exitCode: number | null, note?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (note) add(`${note}\n`);
      resolve({ ok: exitCode === 0, exitCode, output });
    };
    const add = (text: string) => {
      output += text;
      onOutput?.(text);
    };
    const child = spawn(process.execPath, [join(root, "scripts", "compose.mjs"), ...flags], {
      cwd: root,
      env: childEnv({ HIS_CUSTOMER: customerId }),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    child.stdout.on("data", (chunk: Buffer) => add(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => add(chunk.toString()));
    const timer = setTimeout(() => {
      child.kill();
      settle(null, `compose did not finish within ${timeoutMs / 1000} s and was stopped`);
    }, timeoutMs);
    child.on("error", (error) => settle(null, `compose could not be started: ${error.message}`));
    child.on("close", (code) => settle(code));
  });
}

/** Run every compose check on a draft customer.json, writing nothing. */
export async function checkDraft(root: string, customerId: string, draft: Record<string, unknown>): Promise<ComposeResult> {
  const dir = mkdtempSync(join(tmpdir(), "his-panel-"));
  try {
    const file = join(dir, "customer.json");
    writeFileSync(file, JSON.stringify(draft));
    return await runCompose(root, customerId, ["--check", "--customer-file", file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
