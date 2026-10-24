/*
 * The products there are: every packages/<dir>/his.product.json, the same
 * files scripts/compose.mjs reads.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Localized, Product, ProductCatalog, ProductSelection } from "../types.ts";
import { isLocalized, isRecord } from "./repo.ts";

export function readProducts(root: string): ProductCatalog {
  const products: Product[] = [];
  const problems: string[] = [];
  for (const dir of readdirSync(join(root, "packages"))) {
    const file = join(root, "packages", dir, "his.product.json");
    if (!existsSync(file)) continue;
    const where = `packages/${dir}/his.product.json`;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      problems.push(`${where} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const product = parseManifest(raw);
    if (typeof product === "string") {
      problems.push(`${where}: ${product}`);
    } else if (products.some((p) => p.id === product.id)) {
      problems.push(`${where}: product id "${product.id}" is already used by another package`);
    } else {
      products.push(product);
    }
  }
  return { products, problems };
}

type RawNav = { href: string; section?: unknown; label: Localized };
const isNav = (n: unknown): n is RawNav => isRecord(n) && typeof n.href === "string" && isLocalized(n.label);
const isRoute = (r: unknown): r is { path: string } => isRecord(r) && typeof r.path === "string";

/** The manifest as the panel shows it, or why it cannot be read. */
function parseManifest(raw: unknown): Product | string {
  if (!isRecord(raw)) return "not an object";
  const { id, package: pkg, name, nav = [], routes = [], slots = {} } = raw;
  if (typeof id !== "string" || !id) return `"id" must be a non-empty string`;
  if (typeof pkg !== "string" || !pkg) return `"package" must be a non-empty string`;
  if (!isLocalized(name)) return `"name" needs "en" and "ar"`;
  if (!Array.isArray(nav) || !nav.every(isNav)) return `"nav" must be a list of { href, section, label }`;
  if (!Array.isArray(routes) || !routes.every(isRoute)) return `"routes" must be a list of { path, export, title }`;
  if (!isRecord(slots)) return `"slots" must be an object`;
  return {
    id,
    package: pkg,
    name,
    routes: routes.map((r) => r.path),
    nav: nav.map((n) => ({ href: n.href, section: typeof n.section === "string" ? n.section : "", label: n.label })),
    slots: Object.keys(slots),
  };
}

export function isSelection(value: unknown): value is ProductSelection {
  return value === "*" || (Array.isArray(value) && value.every((v): v is string => typeof v === "string"));
}

/** What is wrong with a product selection; empty when it can be saved. */
export function checkSelection(selection: unknown, catalog: ProductCatalog): string[] {
  if (selection === "*") return [];
  if (!Array.isArray(selection)) return [`Products must be "*" (all products) or a list of product ids`];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const id of selection) {
    if (typeof id !== "string") {
      errors.push(`Product ids are strings, got ${JSON.stringify(id)}`);
    } else if (seen.has(id)) {
      errors.push(`"${id}" is selected twice`);
    } else if (!catalog.products.some((p) => p.id === id)) {
      errors.push(`"${id}" is not a product: no packages/*/his.product.json declares it`);
    }
    if (typeof id === "string") seen.add(id);
  }
  return errors;
}
