import { randomUUID } from "node:crypto";
import type { ControlUser, IssueInput, LicenceDetail, LicenceDisplay, LicenceRow, LicenceStatus } from "@his/licence/api";
import { dayOf, evaluateLicence, type LicenceFile, type LicencePayload } from "@his/licence";
import { keyFingerprint, signLicence } from "@his/licence/server";
import { audit } from "./audit.ts";
import type { Config } from "./config.ts";
import { type Db, transaction } from "./db.ts";
import { badRequest, conflict, notFound } from "./http.ts";
import { activeKey } from "./keys.ts";

/*
 * Issuing, renewing and revoking. An installation runs on one active licence;
 * issuing a new one supersedes the old in the same transaction, and an online
 * installation picks the new one up at its next heartbeat. Offline ones get
 * the file delivered and upload it on their Licence page.
 */

type Row = {
  id: string;
  installation_id: string;
  customer_id: string;
  kid: string;
  payload: string;
  signature: string;
  products: string;
  issued_at: string;
  expires_on: string;
  warn_days: number;
  grace_days: number;
  status: LicenceStatus;
  supersedes: string | null;
  superseded_by: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  note: string | null;
  issuer_name: string;
  installation_label: string;
  name_en: string;
  name_ar: string;
};

const SELECT = `
  SELECT l.*, u.name AS issuer_name, i.label AS installation_label, c.name_en, c.name_ar
  FROM licences l
  JOIN users u ON u.id = l.issued_by
  JOIN installations i ON i.id = l.installation_id
  JOIN customers c ON c.id = l.customer_id`;

export function toLicenceRow(r: Row, now = new Date()): LicenceRow {
  const payload = JSON.parse(r.payload) as LicencePayload;
  const evaluation = evaluateLicence(payload, { now, revokedOn: r.revoked_at ? r.revoked_at.slice(0, 10) : null });
  const display: LicenceDisplay = r.status === "active" ? evaluation.state : r.status;
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: { en: r.name_en, ar: r.name_ar },
    installationId: r.installation_id,
    installationLabel: r.installation_label,
    products: JSON.parse(r.products),
    issuedAt: r.issued_at,
    expiresOn: r.expires_on,
    warnDays: r.warn_days,
    graceDays: r.grace_days,
    kid: r.kid,
    status: r.status,
    display,
    revokedAt: r.revoked_at,
    revokeReason: r.revoke_reason,
    supersededBy: r.superseded_by,
    supersedes: r.supersedes,
    issuedBy: r.issuer_name,
    note: r.note,
    evaluation,
  };
}

export function listLicences(
  db: Db,
  filter: { customerId?: string; installationId?: string; status?: LicenceStatus; display?: LicenceDisplay | "expiring"; q?: string } = {},
): LicenceRow[] {
  const where: string[] = [];
  const args: string[] = [];
  if (filter.customerId) {
    where.push("l.customer_id = ?");
    args.push(filter.customerId);
  }
  if (filter.installationId) {
    where.push("l.installation_id = ?");
    args.push(filter.installationId);
  }
  if (filter.status) {
    where.push("l.status = ?");
    args.push(filter.status);
  }
  if (filter.q) {
    where.push("(l.id LIKE ? OR c.name_en LIKE ? OR c.name_ar LIKE ? OR c.id LIKE ? OR i.label LIKE ?)");
    const like = `%${filter.q.replace(/[%_]/g, "")}%`;
    args.push(like, like, like, like, like);
  }
  const rows = db.prepare(`${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY l.issued_at DESC`).all(...args) as Row[];
  const list = rows.map((r) => toLicenceRow(r));
  if (!filter.display) return list;
  if (filter.display === "expiring") return list.filter((l) => l.status === "active" && l.display !== "valid");
  return list.filter((l) => l.display === filter.display);
}

export function getLicenceRow(db: Db, id: string): Row {
  const row = db.prepare(`${SELECT} WHERE l.id = ?`).get(id) as Row | undefined;
  if (!row) throw notFound("Licence");
  return row;
}

export function licenceFile(row: Pick<Row, "payload" | "signature">): LicenceFile {
  return { format: "his-licence", payload: JSON.parse(row.payload), signature: row.signature };
}

export function getLicence(db: Db, id: string): LicenceDetail {
  const row = getLicenceRow(db, id);
  const key = db.prepare("SELECT public_key FROM signing_keys WHERE kid = ?").get(row.kid) as { public_key: string };
  return { ...toLicenceRow(row), file: licenceFile(row), fingerprint: keyFingerprint(key.public_key) };
}

export function activeLicenceRow(db: Db, installationId: string): Row | null {
  return (db.prepare(`${SELECT} WHERE l.installation_id = ? AND l.status = 'active'`).get(installationId) as Row | undefined) ?? null;
}

export function issueLicence(db: Db, config: Config, actor: ControlUser, input: IssueInput): LicenceDetail {
  const installation = db
    .prepare(
      `SELECT i.id, i.label, i.retired_at, c.id AS customer_id, c.name_en, c.name_ar, c.archived_at
       FROM installations i JOIN customers c ON c.id = i.customer_id WHERE i.id = ?`,
    )
    .get(input.installationId) as
    | { id: string; label: string; retired_at: string | null; customer_id: string; name_en: string; name_ar: string; archived_at: string | null }
    | undefined;
  if (!installation) throw notFound("Installation");
  if (installation.retired_at) throw conflict("This installation is retired; licences cannot be issued for it");
  if (installation.archived_at) throw conflict("This customer is archived; restore it before issuing a licence");

  const products = [...new Set(input.products)].sort();
  const known = new Set(
    (db.prepare("SELECT id FROM products WHERE retired = 0").all() as { id: string }[]).map((r) => r.id),
  );
  const unknown = products.filter((id) => !known.has(id));
  if (unknown.length) throw badRequest(`Not in the catalog: ${unknown.join(", ")}. Sync the catalog, or remove them.`, "UNKNOWN_PRODUCT");
  const today = dayOf(new Date());
  if (input.expiresOn < today) throw badRequest("The expiry date is in the past", "EXPIRES_IN_PAST");

  const key = activeKey(db, config);
  const payload: LicencePayload = {
    v: 1,
    kid: key.kid,
    licenceId: randomUUID(),
    customerId: installation.customer_id,
    customerName: { en: installation.name_en, ar: installation.name_ar },
    installationId: installation.id,
    issuedAt: new Date().toISOString(),
    expiresOn: input.expiresOn,
    warnDays: input.warnDays,
    graceDays: input.graceDays,
    products,
  };
  const file = signLicence(payload, key.privateKey);

  transaction(db, () => {
    // the old one stops being active first (one active per installation), and
    // points at the new one only once that row exists (foreign key)
    const previous = activeLicenceRow(db, installation.id);
    if (previous) db.prepare("UPDATE licences SET status = 'superseded' WHERE id = ?").run(previous.id);
    db.prepare(
      `INSERT INTO licences (id, installation_id, customer_id, kid, payload, signature, products, issued_at, expires_on,
         warn_days, grace_days, status, supersedes, issued_by, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).run(
      payload.licenceId,
      installation.id,
      installation.customer_id,
      key.kid,
      JSON.stringify(payload),
      file.signature,
      JSON.stringify(products),
      payload.issuedAt,
      payload.expiresOn,
      payload.warnDays,
      payload.graceDays,
      previous?.id ?? null,
      actor.id,
      input.note?.trim() || null,
    );
    if (previous) db.prepare("UPDATE licences SET superseded_by = ? WHERE id = ?").run(payload.licenceId, previous.id);
    const what = products.length ? products.join(", ") : "core only";
    audit(
      db,
      actor,
      previous ? "licence.renewed" : "licence.issued",
      { type: "licence", id: payload.licenceId },
      `${previous ? "Renewed" : "Issued"} licence for ${installation.name_en} · ${installation.label}: ${what}, until ${payload.expiresOn}`,
    );
  });
  return getLicence(db, payload.licenceId);
}

/**
 * Revoking a renewal undoes it: the licence it replaced (which the hospital
 * paid for, and an offline site still holds) is active again. To end that one
 * too, revoke it next. Retiring an installation ends everything instead
 * (`restorePrevious: false`). Runs inside the caller's transaction.
 */
function revokeInTransaction(
  db: Db,
  actor: ControlUser | null,
  row: Row,
  reason: string,
  { restorePrevious }: { restorePrevious: boolean },
): string | null {
  db.prepare("UPDATE licences SET status = 'revoked', revoked_at = ?, revoke_reason = ? WHERE id = ?").run(new Date().toISOString(), reason, row.id);
  let restored: string | null = null;
  if (restorePrevious && row.supersedes) {
    const previous = db.prepare("SELECT status, superseded_by FROM licences WHERE id = ?").get(row.supersedes) as
      | { status: LicenceStatus; superseded_by: string | null }
      | undefined;
    if (previous?.status === "superseded" && previous.superseded_by === row.id) {
      db.prepare("UPDATE licences SET status = 'active', superseded_by = NULL WHERE id = ?").run(row.supersedes);
      restored = row.supersedes;
    }
  }
  audit(
    db,
    actor,
    "licence.revoked",
    { type: "licence", id: row.id },
    `Revoked licence for ${row.name_en} · ${row.installation_label}: ${reason}${
      restored ? `; the licence it replaced (${restored.slice(0, 8)}) is active again` : ""
    }`,
  );
  return restored;
}

export function revokeLicence(
  db: Db,
  actor: ControlUser | null,
  id: string,
  reason: string,
  { restorePrevious = true, inTransaction = false }: { restorePrevious?: boolean; inTransaction?: boolean } = {},
) {
  const row = getLicenceRow(db, id);
  if (row.status !== "active") throw conflict(`Only an active licence can be revoked; this one is ${row.status}`);
  const work = () => revokeInTransaction(db, actor, row, reason, { restorePrevious });
  const restored = inTransaction ? work() : transaction(db, work);
  return { licence: getLicence(db, id), restored };
}
