import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ControlUser, CustomerTheme, OwnCode, Product } from "@his/licence/api";
import { THEMES } from "@his/ui/theme";
import { audit } from "./audit.ts";
import type { Config } from "./config.ts";
import { type Db, getMeta, setMeta, transaction } from "./db.ts";

/*
 * What the control plane reads from the repository. In the POC the server
 * runs inside it; in production CI publishes the same facts with each
 * release (the catalog of every product, and which customers have code).
 *
 *   packages/<p>/his.product.json   the catalog: what can be sold
 *   customers/<id>/                 a customer's build input (name, features, own code)
 */

type Manifest = { id: string; package: string; name: { en: string; ar: string }; routes?: { path: string }[]; slots?: Record<string, unknown> };

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

/** Reads every his.product.json; products that disappeared are kept, marked retired. */
export function syncCatalog(db: Db, config: Config, actor: ControlUser | null) {
  const dir = join(config.repoRoot, "packages");
  const found: Manifest[] = [];
  const problems: string[] = [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, "his.product.json");
    if (!existsSync(file)) continue;
    try {
      const m = readJson(file) as Manifest;
      if (typeof m.id !== "string" || typeof m.package !== "string" || typeof m.name?.en !== "string") {
        throw new Error("needs id, package and name");
      }
      found.push(m);
    } catch (error) {
      problems.push(`packages/${name}/his.product.json: ${(error as Error).message}`);
    }
  }
  const at = new Date().toISOString();
  const before = new Set((db.prepare("SELECT id FROM products WHERE retired = 0").all() as { id: string }[]).map((r) => r.id));
  transaction(db, () => {
    const upsert = db.prepare(
      `INSERT INTO products (id, package, name_en, name_ar, routes, slots, retired, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT (id) DO UPDATE SET package = excluded.package, name_en = excluded.name_en, name_ar = excluded.name_ar,
         routes = excluded.routes, slots = excluded.slots, retired = 0, synced_at = excluded.synced_at`,
    );
    for (const m of found) {
      upsert.run(
        m.id,
        m.package,
        m.name.en,
        m.name.ar ?? m.name.en,
        JSON.stringify((m.routes ?? []).map((r) => r.path)),
        JSON.stringify(Object.keys(m.slots ?? {})),
        at,
      );
    }
    const ids = found.map((m) => m.id);
    db.prepare(`UPDATE products SET retired = 1 WHERE id NOT IN (${ids.map(() => "?").join(",") || "''"})`).run(...ids);
    const added = ids.filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !ids.includes(id));
    if (actor || added.length || removed.length) {
      const parts = [`${ids.length} product(s)`];
      if (added.length) parts.push(`added ${added.join(", ")}`);
      if (removed.length) parts.push(`retired ${removed.join(", ")}`);
      audit(db, actor, "catalog.synced", { type: "catalog", id: "catalog" }, `Catalog synced: ${parts.join("; ")}`);
    }
  });
  return { products: found.length, problems };
}

type ProductRow = { id: string; package: string; name_en: string; name_ar: string; routes: string; slots: string; retired: number; synced_at: string };

export function listProducts(db: Db): Product[] {
  const active = db.prepare("SELECT products FROM licences WHERE status = 'active'").all() as { products: string }[];
  const counts = new Map<string, number>();
  for (const row of active) for (const id of JSON.parse(row.products) as string[]) counts.set(id, (counts.get(id) ?? 0) + 1);
  const rows = db.prepare("SELECT * FROM products ORDER BY retired, name_en").all() as ProductRow[];
  return rows.map((r) => ({
    id: r.id,
    package: r.package,
    name: { en: r.name_en, ar: r.name_ar },
    routes: JSON.parse(r.routes),
    slots: JSON.parse(r.slots),
    retired: r.retired === 1,
    syncedAt: r.synced_at,
    licences: counts.get(r.id) ?? 0,
  }));
}

/** The customer's own code, when customers/<id> has a package.json. */
export function ownCode(config: Config, customerId: string): OwnCode | null {
  const dir = join(config.repoRoot, "customers", customerId);
  if (!existsSync(join(dir, "package.json"))) return null;
  try {
    const pkg = readJson(join(dir, "package.json"));
    const customer = existsSync(join(dir, "customer.json")) ? readJson(join(dir, "customer.json")) : {};
    const ext = customer.extensions ?? {};
    return {
      package: String(pkg.name),
      routes: (ext.routes ?? []).map((r: { path: string }) => r.path),
      slots: Object.keys(ext.slots ?? {}),
    };
  } catch {
    return null;
  }
}

/** The default theme, alone: what a customer without any theme setting gets. */
export const DEFAULT_THEME: CustomerTheme = { default: "slate", allowed: ["slate"], brand: null };

/**
 * The customer's themes as its build input says (customers/<id>/customer.json →
 * "theme"), with the older on/off switch read as compose reads it: on = every
 * theme, off = slate only.
 */
export function readCustomerTheme(config: Config, customerId: string): CustomerTheme {
  const file = join(config.repoRoot, "customers", customerId, "customer.json");
  if (!existsSync(file)) return DEFAULT_THEME;
  try {
    const c = readJson(file);
    if (c.theme && Array.isArray(c.theme.allowed) && c.theme.allowed.length) {
      const allowed = THEMES.filter((t) => c.theme.allowed.includes(t));
      if (allowed.length === 0) return DEFAULT_THEME;
      const fallback = allowed.includes(c.theme.default) ? c.theme.default : allowed[0];
      // the same reading as compose: a colour like #1f6f8b, lowercased; anything else is no colour
      const brand = typeof c.theme.brand === "string" && /^#[0-9a-f]{6}$/i.test(c.theme.brand) ? c.theme.brand.toLowerCase() : null;
      return { default: fallback, allowed, brand: allowed.includes("custom") ? brand : null };
    }
    return c.features?.themePaletteCustomization === true ? { default: "slate", allowed: [...THEMES], brand: null } : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Writes the customer's themes into its build input, where compose reads
 * them. Every other key is kept; the older on/off switch is dropped, since
 * "theme" now says it all.
 */
export function writeCustomerTheme(config: Config, customerId: string, theme: CustomerTheme) {
  const dir = join(config.repoRoot, "customers", customerId);
  const file = join(dir, "customer.json");
  if (!existsSync(file)) throw new Error(`customers/${customerId}/customer.json is missing`);
  const c = readJson(file);
  c.theme = theme;
  if (c.features && typeof c.features === "object") {
    delete c.features.themePaletteCustomization;
    if (Object.keys(c.features).length === 0) delete c.features;
  }
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(c, null, 2)}\n`);
  renameSync(temp, file);
}

/**
 * compose needs customers/<id>/customer.json to build for a customer. A new
 * customer gets a minimal one (products come from its licence). An existing
 * folder is never touched.
 */
export function registerCustomerFolder(config: Config, customer: { id: string; name: { en: string; ar: string } }) {
  const dir = join(config.repoRoot, "customers", customer.id);
  if (existsSync(join(dir, "customer.json"))) return false;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "customer.json"),
    `${JSON.stringify({ id: customer.id, name: customer.name, products: [], theme: DEFAULT_THEME }, null, 2)}\n`,
  );
  return true;
}

/**
 * First start only: the customers the repository already knows become
 * customers of the control plane (without licences — those are issued here).
 * "all" is the developers' everything-build, not a customer.
 */
export function importCustomers(db: Db, config: Config) {
  if (getMeta(db, "customers_imported")) return 0;
  const dir = join(config.repoRoot, "customers");
  let imported = 0;
  transaction(db, () => {
    for (const id of existsSync(dir) ? readdirSync(dir) : []) {
      const file = join(dir, id, "customer.json");
      if (id === "all" || !existsSync(file)) continue;
      try {
        const c = readJson(file);
        if (c.id !== id || typeof c.name?.en !== "string") continue;
        const exists = db.prepare("SELECT 1 FROM customers WHERE id = ?").get(id);
        if (exists) continue;
        db.prepare("INSERT INTO customers (id, name_en, name_ar, created_at) VALUES (?, ?, ?, ?)").run(
          id,
          c.name.en,
          c.name.ar ?? c.name.en,
          new Date().toISOString(),
        );
        audit(db, null, "customer.imported", { type: "customer", id }, `Imported ${c.name.en} from customers/${id}`);
        imported += 1;
      } catch {
        // a folder compose cannot read either; the customer panel reports it
      }
    }
    setMeta(db, "customers_imported", new Date().toISOString());
  });
  return imported;
}
