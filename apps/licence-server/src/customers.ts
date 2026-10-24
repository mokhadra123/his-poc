import type { ControlUser, Customer, CustomerInput, CustomerTheme, CustomerUpdate, Standing } from "@his/licence/api";
import { audit } from "./audit.ts";
import type { Config } from "./config.ts";
import { type Db, transaction } from "./db.ts";
import { ApiError, conflict, notFound } from "./http.ts";
import { listInstallations } from "./installations.ts";
import { ownCode, readCustomerTheme, registerCustomerFolder, writeCustomerTheme } from "./repo.ts";

/*
 * A customer is the commercial record (who, contacts, what they bought —
 * through licences). What a build needs from the repository (its name,
 * features, own code) stays in customers/<id>; a new customer gets that
 * folder so compose can build for it.
 */

type Row = {
  id: string;
  name_en: string;
  name_ar: string;
  contact_name: string | null;
  contact_email: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  archived_at: string | null;
  /** JSON CustomerTheme; null until first set here (customer.json says it until then) */
  theme: string | null;
};

/** what needs a person first */
const SEVERITY: Record<Standing["state"], number> = { "read-only": 4, grace: 3, warning: 2, unlicensed: 1, valid: 0 };

export function standingOf(installations: ReturnType<typeof listInstallations>): { standing: Standing; products: string[] } {
  const live = installations.filter((i) => !i.retiredAt);
  const products = [...new Set(live.flatMap((i) => i.licence?.products ?? []))].sort();
  if (live.length === 0) return { standing: { state: "unlicensed", endsOn: null, daysLeft: null }, products };
  let worst: Standing["state"] = "valid";
  for (const i of live) {
    const state = i.licence ? i.licence.evaluation.state : "unlicensed";
    if (SEVERITY[state] > SEVERITY[worst]) worst = state;
  }
  const ends = live.flatMap((i) => (i.licence ? [i.licence.evaluation] : [])).sort((a, b) => a.daysLeft - b.daysLeft);
  return { standing: { state: worst, endsOn: ends[0]?.timeline.endsOn ?? null, daysLeft: ends[0]?.daysLeft ?? null }, products };
}

function toCustomer(db: Db, config: Config, r: Row): Customer {
  const installations = listInstallations(db, { customerId: r.id });
  const { standing, products } = standingOf(installations);
  return {
    id: r.id,
    name: { en: r.name_en, ar: r.name_ar },
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    country: r.country,
    notes: r.notes,
    createdAt: r.created_at,
    archivedAt: r.archived_at,
    ownCode: ownCode(config, r.id),
    installations: installations.filter((i) => !i.retiredAt).length,
    products,
    standing,
    theme: r.theme ? (JSON.parse(r.theme) as CustomerTheme) : readCustomerTheme(config, r.id),
  };
}

export function listCustomers(db: Db, config: Config, { q, archived = false }: { q?: string; archived?: boolean } = {}): Customer[] {
  const where = [archived ? "archived_at IS NOT NULL" : "archived_at IS NULL"];
  const args: string[] = [];
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    where.push("(id LIKE ? OR name_en LIKE ? OR name_ar LIKE ? OR contact_name LIKE ? OR contact_email LIKE ?)");
    args.push(like, like, like, like, like);
  }
  const rows = db.prepare(`SELECT * FROM customers WHERE ${where.join(" AND ")} ORDER BY name_en`).all(...args) as Row[];
  return rows.map((r) => toCustomer(db, config, r));
}

export function getCustomer(db: Db, config: Config, id: string): Customer {
  const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as Row | undefined;
  if (!row) throw notFound("Customer");
  return toCustomer(db, config, row);
}

const clean = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

export function createCustomer(db: Db, config: Config, actor: ControlUser, input: CustomerInput) {
  if (db.prepare("SELECT 1 FROM customers WHERE id = ?").get(input.id)) {
    throw new ApiError(409, "CONFLICT", `A customer with the id "${input.id}" already exists`, [
      { field: "id", message: `"${input.id}" is taken — ids are permanent, pick another` },
    ]);
  }
  transaction(db, () => {
    db.prepare(
      `INSERT INTO customers (id, name_en, name_ar, contact_name, contact_email, country, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.id,
      input.name.en.trim(),
      input.name.ar.trim(),
      clean(input.contactName),
      clean(input.contactEmail),
      clean(input.country),
      clean(input.notes),
      new Date().toISOString(),
    );
    audit(db, actor, "customer.created", { type: "customer", id: input.id }, `Created customer ${input.name.en}`);
  });
  const registered = registerCustomerFolder(config, { id: input.id, name: input.name });
  return { customer: getCustomer(db, config, input.id), registered };
}

export function updateCustomer(db: Db, config: Config, actor: ControlUser, id: string, input: CustomerUpdate) {
  const before = getCustomer(db, config, id);
  transaction(db, () => {
    db.prepare(
      `UPDATE customers SET name_en = ?, name_ar = ?, contact_name = ?, contact_email = ?, country = ?, notes = ? WHERE id = ?`,
    ).run(input.name.en.trim(), input.name.ar.trim(), clean(input.contactName), clean(input.contactEmail), clean(input.country), clean(input.notes), id);
    audit(db, actor, "customer.updated", { type: "customer", id }, `Updated ${before.name.en}`);
  });
  return getCustomer(db, config, id);
}

export function setArchived(db: Db, config: Config, actor: ControlUser, id: string, archived: boolean) {
  const before = getCustomer(db, config, id);
  if (archived && before.installations > 0) {
    throw conflict("Retire the customer's installations first; archiving does not stop a running hospital");
  }
  transaction(db, () => {
    db.prepare("UPDATE customers SET archived_at = ? WHERE id = ?").run(archived ? new Date().toISOString() : null, id);
    audit(db, actor, archived ? "customer.archived" : "customer.restored", { type: "customer", id }, `${archived ? "Archived" : "Restored"} ${before.name.en}`);
  });
  return getCustomer(db, config, id);
}

const themeSummary = (t: CustomerTheme) =>
  `${t.allowed.length > 1 ? `${t.allowed.join(", ")} (default ${t.default})` : `${t.default} only`}${t.brand ? `, brand ${t.brand}` : ""}`;

/**
 * The themes a customer's users get. Saved here and written into
 * customers/<id>/customer.json, which compose reads: it applies from the
 * next build of the customer.
 */
export function setCustomerTheme(db: Db, config: Config, actor: ControlUser, id: string, theme: CustomerTheme) {
  const before = getCustomer(db, config, id);
  const allowed = [...new Set(theme.allowed)];
  if (!allowed.includes(theme.default)) {
    throw new ApiError(400, "VALIDATION_FAILED", "The default theme must be one of the allowed themes", [
      { field: "default", message: "Pick a default among the allowed themes" },
    ]);
  }
  const brand = allowed.includes("custom") ? (theme.brand?.toLowerCase() ?? null) : null;
  const next: CustomerTheme = { default: theme.default, allowed, brand };
  transaction(db, () => {
    db.prepare("UPDATE customers SET theme = ? WHERE id = ?").run(JSON.stringify(next), id);
    audit(db, actor, "customer.theme", { type: "customer", id }, `Themes of ${before.name.en}: ${themeSummary(next)}`);
  });
  writeCustomerTheme(config, id, next);
  return getCustomer(db, config, id);
}
