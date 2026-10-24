/*
 * Where this installation's licence stands, as JSON: for the installer's
 * check after it starts HIS, and for a container health check. It leaves out
 * the installation and licence ids — with them, anyone could pose as this
 * installation at the licence server's heartbeat.
 */
import { getLicence, isReadOnly, readState } from "@/lib/licence";
import { CUSTOMER } from "@/lib/products.generated";

export const dynamic = "force-dynamic";

export function GET() {
  const check = getLicence();
  const heartbeat = check.licensing ? readState().lastHeartbeat : null;
  const body = !check.licensing
    ? { licensing: false, customer: CUSTOMER.id, readOnly: false }
    : check.status === "ok"
      ? {
          licensing: true,
          customer: CUSTOMER.id,
          status: "ok",
          state: check.evaluation.state,
          readOnly: isReadOnly(check),
          expiresOn: check.payload.expiresOn,
          daysLeft: check.evaluation.daysLeft,
          products: check.payload.products,
          notBuilt: check.notBuilt,
          heartbeat: heartbeat ? { at: heartbeat.at, status: heartbeat.status } : null,
          version: process.env.HIS_VERSION ?? null,
        }
      : {
          licensing: true,
          customer: CUSTOMER.id,
          status: check.status,
          reason: check.status === "invalid" ? check.reason : "No licence is installed",
          readOnly: true,
          version: process.env.HIS_VERSION ?? null,
        };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
