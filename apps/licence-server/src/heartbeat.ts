import type { HeartbeatInput, HeartbeatResult } from "@his/licence/api";
import type { Db } from "./db.ts";
import { activeLicenceRow, getLicenceRow, licenceFile } from "./licences.ts";

/*
 * An online installation reports in. The answer tells it whether a newer
 * licence is waiting (it installs it — renewal without anyone touching the
 * server) or that its licence was revoked. It is never told to stop: the
 * licence's own dates decide that, offline or not.
 *
 * No session: the caller proves nothing but knowing an installation id and
 * the id of a licence issued for it. Production should give installations a
 * secret of their own; a licence file is not one.
 */

export function heartbeat(db: Db, input: HeartbeatInput, address: string | null): HeartbeatResult {
  const installation = db.prepare("SELECT id, retired_at FROM installations WHERE id = ?").get(input.installationId) as
    | { id: string; retired_at: string | null }
    | undefined;
  if (!installation) return { status: "unknown", message: "This installation is not known to the licence server" };

  let licence: ReturnType<typeof getLicenceRow>;
  try {
    licence = getLicenceRow(db, input.licenceId);
  } catch {
    return { status: "unknown", message: "This licence is not known to the licence server" };
  }
  if (licence.installation_id !== installation.id) {
    return { status: "unknown", message: "This licence was issued for another installation" };
  }

  db.prepare(
    "INSERT INTO heartbeats (installation_id, licence_id, instance_id, at, version, state, address) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(installation.id, licence.id, input.instanceId, new Date().toISOString(), input.version ?? null, input.state ?? null, address);

  // the installation should run the active licence, whichever it is: a newer
  // one (a renewal), or an older one made current again (a renewal revoked)
  const active = activeLicenceRow(db, installation.id);
  if (active && active.id !== licence.id) {
    const restored = active.issued_at < licence.issued_at;
    return {
      status: "renewed",
      message: restored
        ? `The licence this installation runs was revoked; the one it replaced (until ${active.expires_on}) is current again — install it`
        : `A newer licence (until ${active.expires_on}) was issued; install it`,
      licence: licenceFile(active),
    };
  }
  if (active) return { status: "ok", message: `Licence is current (until ${active.expires_on})` };

  // no active licence at all: the installation was retired, or its licence
  // revoked. Follow the chain from the one it has to where it ended.
  let end = licence;
  while (end.status === "superseded" && end.superseded_by) end = getLicenceRow(db, end.superseded_by);
  if (end.status === "revoked") {
    const revokedOn = (end.revoked_at ?? new Date().toISOString()).slice(0, 10);
    return { status: "revoked", message: `The licence was revoked on ${revokedOn}: ${end.revoke_reason ?? "no reason given"}`, revokedOn };
  }
  return { status: "ok", message: "No newer licence" };
}
