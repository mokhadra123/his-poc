import { randomUUID } from "node:crypto";
import type { ControlUser, Heartbeat, Installation, InstallationInput } from "@his/licence/api";
import { audit } from "./audit.ts";
import { type Db, transaction } from "./db.ts";
import { conflict, notFound } from "./http.ts";
import { activeLicenceRow, revokeLicence, toLicenceRow } from "./licences.ts";

/* One deployment of HIS at a customer: production, a test copy, a second site. Each has its own licence. */

/** An online installation that has not reported for this long needs a look. */
export const SILENT_AFTER_DAYS = 3;
/** Running copies are counted over this window; more than one means the licence is in use twice. */
export const INSTANCE_WINDOW_DAYS = 30;

type Row = {
  id: string;
  customer_id: string;
  label: string;
  environment: Installation["environment"];
  connectivity: Installation["connectivity"];
  created_at: string;
  retired_at: string | null;
  name_en: string;
  name_ar: string;
};

function lastHeartbeat(db: Db, installationId: string): Heartbeat | null {
  const row = db
    .prepare("SELECT at, instance_id, version, state, address FROM heartbeats WHERE installation_id = ? ORDER BY at DESC LIMIT 1")
    .get(installationId) as { at: string; instance_id: string; version: string | null; state: string | null; address: string | null } | undefined;
  return row ? { at: row.at, instanceId: row.instance_id, version: row.version, state: row.state, address: row.address } : null;
}

function instances(db: Db, installationId: string): number {
  const since = new Date(Date.now() - INSTANCE_WINDOW_DAYS * 86_400_000).toISOString();
  const row = db
    .prepare("SELECT count(DISTINCT instance_id) AS n FROM heartbeats WHERE installation_id = ? AND at >= ?")
    .get(installationId, since) as { n: number };
  return Number(row.n);
}

function toInstallation(db: Db, r: Row): Installation {
  const licence = activeLicenceRow(db, r.id);
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: { en: r.name_en, ar: r.name_ar },
    label: r.label,
    environment: r.environment,
    connectivity: r.connectivity,
    createdAt: r.created_at,
    retiredAt: r.retired_at,
    lastHeartbeat: lastHeartbeat(db, r.id),
    instances: instances(db, r.id),
    licence: licence ? toLicenceRow(licence) : null,
  };
}

const SELECT = "SELECT i.*, c.name_en, c.name_ar FROM installations i JOIN customers c ON c.id = i.customer_id";

export function listInstallations(db: Db, { customerId, includeRetired = true }: { customerId?: string; includeRetired?: boolean } = {}) {
  const where: string[] = [];
  const args: string[] = [];
  if (customerId) {
    where.push("i.customer_id = ?");
    args.push(customerId);
  }
  if (!includeRetired) where.push("i.retired_at IS NULL");
  const rows = db
    .prepare(`${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY i.retired_at IS NOT NULL, c.name_en, i.created_at`)
    .all(...args) as Row[];
  return rows.map((r) => toInstallation(db, r));
}

export function getInstallation(db: Db, id: string): Installation {
  const row = db.prepare(`${SELECT} WHERE i.id = ?`).get(id) as Row | undefined;
  if (!row) throw notFound("Installation");
  return toInstallation(db, row);
}

export function createInstallation(db: Db, actor: ControlUser, customerId: string, input: InstallationInput): Installation {
  const customer = db.prepare("SELECT name_en, archived_at FROM customers WHERE id = ?").get(customerId) as
    | { name_en: string; archived_at: string | null }
    | undefined;
  if (!customer) throw notFound("Customer");
  if (customer.archived_at) throw conflict("This customer is archived");
  const id = randomUUID();
  transaction(db, () => {
    db.prepare(
      "INSERT INTO installations (id, customer_id, label, environment, connectivity, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, customerId, input.label, input.environment, input.connectivity, new Date().toISOString());
    audit(
      db,
      actor,
      "installation.created",
      { type: "installation", id },
      `Added installation "${input.label}" for ${customer.name_en} (${input.environment}, ${input.connectivity})`,
    );
  });
  return getInstallation(db, id);
}

export function updateInstallation(db: Db, actor: ControlUser, id: string, input: InstallationInput): Installation {
  const before = getInstallation(db, id);
  if (before.retiredAt) throw conflict("A retired installation cannot be changed");
  transaction(db, () => {
    db.prepare("UPDATE installations SET label = ?, environment = ?, connectivity = ? WHERE id = ?").run(
      input.label,
      input.environment,
      input.connectivity,
      id,
    );
    audit(db, actor, "installation.updated", { type: "installation", id }, `Updated installation "${input.label}" of ${before.customerName.en}`);
  });
  return getInstallation(db, id);
}

/** Decommissioned: its active licence is revoked with it. */
export function retireInstallation(db: Db, actor: ControlUser, id: string): Installation {
  const before = getInstallation(db, id);
  if (before.retiredAt) throw conflict("This installation is already retired");
  // one transaction: never a revoked licence on an installation that still looks live
  transaction(db, () => {
    if (before.licence) {
      revokeLicence(db, actor, before.licence.id, "Installation retired", { restorePrevious: false, inTransaction: true });
    }
    db.prepare("UPDATE installations SET retired_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    audit(db, actor, "installation.retired", { type: "installation", id }, `Retired installation "${before.label}" of ${before.customerName.en}`);
  });
  return getInstallation(db, id);
}
