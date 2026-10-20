/*
 * Where the panel may read and write, and the guard on customer ids.
 * Server only: the browser never names a path, only a customer id, and every
 * id goes through checkCustomerId() before it touches the filesystem.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Localized } from "../types.ts";

/** A mistake the user can fix; its message is shown as is. */
export class PanelError extends Error {
  output: string | undefined;
  constructor(message: string, output?: string) {
    super(message);
    this.name = "PanelError";
    this.output = output;
  }
}

/** The repository the panel manages. The panel runs from apps/customer-panel. */
// Get Current work directory and resolve the root of the repository by going up two levels. This is based on the assumption that the panel is located in a specific directory structure within the repository.
export function findRepoRoot(start = process.cwd()): string {
  const root = resolve(start, "../..");
  for (const marker of ["scripts/compose.mjs", "customers", "apps/showcase/package.json"]) {
    if (!existsSync(join(root, marker))) {
      throw new Error(`${root} does not look like the HIS repository: ${marker} is missing`);
    }
  }
  return root;
}

const ID = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
// Windows refuses these as folder names
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;

/** Why `id` cannot be a customer id, or null when it can. */
export function checkCustomerId(id: unknown): string | null {
  if (typeof id !== "string" || !ID.test(id)) {
    return "A customer id is 1–40 characters: lowercase letters, digits and inner hyphens (al-amal)";
  }
  if (RESERVED.test(id)) return `"${id}" is reserved by Windows`;
  return null;
}

/** customers/<id>, for a checked id only. */
export function customerDir(root: string, id: string): string {
  const problem = checkCustomerId(id);
  if (problem) throw new PanelError(problem);
  const base = join(root, "customers");
  const dir = join(base, id);
  if (dirname(dir) !== base) throw new PanelError(`"${id}" is not a folder inside customers/`);
  return dir;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isLocalized(value: unknown): value is Localized {
  return isRecord(value) && typeof value.en === "string" && typeof value.ar === "string";
}
