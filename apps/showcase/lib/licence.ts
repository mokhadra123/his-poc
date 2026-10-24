/*
 * The runtime licence check, as pages, layouts and route shells use it.
 * Server only. The store itself (reading, verifying, installing, the cache)
 * is lib/licence-store.ts, which the heartbeat shares.
 *
 * Policy: warn → grace → read-only, never a hard stop. Read-only keeps
 * viewing, printing and exporting, and refuses new records. The UI only
 * disables the actions (components/licence-client.tsx); the real refusal
 * belongs in the backend, which must run the same check before it writes.
 */
import "server-only";
import { notFound } from "next/navigation";
import { getLicence, type LicenceCheck } from "./licence-store";

export {
  getLicence,
  type HeartbeatRecord,
  type InstallResult,
  type InvalidCode,
  installLicence,
  type LicenceCheck,
  readState,
} from "./licence-store";

/** Licensing is on, and there is no licence this build accepts, or it is past its grace. */
export function isReadOnly(check: LicenceCheck): boolean {
  return check.licensing && (check.status !== "ok" || check.evaluation.readOnly);
}

/** Products composed in but not on the installed licence: hidden from the sidebar. */
export function unlicensedProducts(check: LicenceCheck): string[] {
  return check.licensing && check.status === "ok" ? check.notLicensed : [];
}

/**
 * Called by the generated route shell of every product route. A product the
 * installed licence no longer includes answers 404. A missing or invalid
 * licence does not: read-only already covers it, and the pages stay viewable.
 */
export async function requireProduct(id: string): Promise<void> {
  const check = getLicence();
  if (check.licensing && check.status === "ok" && !check.payload.products.includes(id)) notFound();
}
