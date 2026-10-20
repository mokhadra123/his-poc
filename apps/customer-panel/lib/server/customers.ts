/*
 * Customers: every customers/<id>/customer.json, the folders compose reads.
 * The panel edits name, products and features only; everything else in the
 * file — extensions, keys it does not know — is written back as it was read.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CustomerConfig, CustomerEdit, CustomerEntry, Localized, ProductCatalog } from "../types.ts";
import { checkSelection, isSelection } from "./products.ts";
import { checkCustomerId, customerDir, isLocalized, isRecord, PanelError } from "./repo.ts";

export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function listCustomers(root: string): CustomerEntry[] {
  const base = join(root, "customers");
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(base, d.name, "customer.json")))
    .map((d) => readEntry(root, d.name));
}

/** An editable customer, or a PanelError saying why there is none. */
export function getCustomer(root: string, id: string): CustomerConfig {
  if (!existsSync(join(customerDir(root, id), "customer.json"))) throw new PanelError(`There is no customer "${id}"`);
  const entry = readEntry(root, id);
  if (entry.config === null) throw new PanelError(`customers/${id}/customer.json cannot be edited here: ${entry.problem}`);
  return entry.config;
}

function readEntry(root: string, id: string): CustomerEntry {
  const invalid = checkCustomerId(id);
  if (invalid) return { id, config: null, problem: `the folder name is not a valid id. ${invalid}` };
  const dir = customerDir(root, id);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(dir, "customer.json"), "utf8"));
  } catch (error) {
    return { id, config: null, problem: `customer.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const config = parseConfig(id, raw, ownPackage(dir));
  return typeof config === "string" ? { id, config: null, problem: config } : { id, config, problem: null };
}

function parseConfig(id: string, raw: unknown, own: string | null): CustomerConfig | string {
  if (!isRecord(raw)) return "customer.json is not an object";
  if (raw.id !== id) return `its "id" is ${JSON.stringify(raw.id)}, but the folder is "${id}"`;
  if (!isLocalized(raw.name)) return `"name" needs "en" and "ar"`;
  if (!isSelection(raw.products)) return `"products" must be "*" or a list of product ids`;
  // missing features, or a missing flag, mean "not allowed"
  const features = raw.features ?? {};
  if (!isRecord(features)) return `"features" must be an object`;
  const palette = features.themePaletteCustomization ?? false;
  if (typeof palette !== "boolean") return `"features.themePaletteCustomization" must be true or false`;
  const ext = isRecord(raw.extensions) ? raw.extensions : {};
  return {
    id,
    name: raw.name,
    products: raw.products,
    features: { themePaletteCustomization: palette },
    extensions: {
      routes: Array.isArray(ext.routes)
        ? ext.routes.flatMap((r: unknown) => (isRecord(r) && typeof r.path === "string" ? [r.path] : []))
        : [],
      nav: Array.isArray(ext.nav) ? ext.nav.length : 0,
      slots: isRecord(ext.slots) ? Object.keys(ext.slots) : [],
    },
    ownPackage: own,
  };
}

/** A customer folder with a package.json has code of its own (as in compose). */
function ownPackage(dir: string): string | null {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return null;
  try {
    const pkg: unknown = JSON.parse(readFileSync(file, "utf8"));
    return isRecord(pkg) && typeof pkg.name === "string" ? pkg.name : null;
  } catch {
    return null;
  }
}

/* ---------- editing ---------- */

const MAX_NAME = 120;
// a display name has no use for control characters
const CONTROL = /[\u0000-\u001f\u007f]/;

function readName(value: unknown, errors: string[]): Localized {
  const name: Localized = { en: "", ar: "" };
  if (!isRecord(value)) {
    errors.push("A name in English and Arabic is required");
    return name;
  }
  for (const [lang, label] of [["en", "English"], ["ar", "Arabic"]] as const) {
    const raw = value[lang];
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) errors.push(`The ${label} name is required`);
    else if (text.length > MAX_NAME) errors.push(`The ${label} name is longer than ${MAX_NAME} characters`);
    else if (CONTROL.test(text)) errors.push(`The ${label} name contains control characters`);
    name[lang] = text;
  }
  return name;
}

/** The edit as the browser sent it, checked against the products there are. */
export function parseEdit(input: unknown, catalog: ProductCatalog): Checked<CustomerEdit> {
  if (!isRecord(input)) return { ok: false, errors: ["Nothing to save"] };
  const errors: string[] = [];
  const name = readName(input.name, errors);
  const products = input.products;
  errors.push(...checkSelection(products, catalog));
  const palette = isRecord(input.features) ? input.features.themePaletteCustomization : undefined;
  if (typeof palette !== "boolean") errors.push(`"Allow theme palette changes" must be on or off`);
  if (errors.length > 0 || !isSelection(products) || typeof palette !== "boolean") return { ok: false, errors };
  return { ok: true, value: { name, products, features: { themePaletteCustomization: palette } } };
}

/** customer.json as it would be saved: the edited fields replaced, the rest re-read from disk and kept. */
export function buildDraft(root: string, id: string, edit: CustomerEdit): Record<string, unknown> {
  getCustomer(root, id);
  const raw: unknown = JSON.parse(readFileSync(join(customerDir(root, id), "customer.json"), "utf8"));
  if (!isRecord(raw)) throw new PanelError(`customers/${id}/customer.json is not an object`);
  const features = isRecord(raw.features) ? raw.features : {};
  return {
    ...raw,
    name: edit.name,
    products: edit.products,
    features: { ...features, themePaletteCustomization: edit.features.themePaletteCustomization },
  };
}

/** Replace customer.json in one step, so a compose reading it never sees half a file. */
export function writeCustomer(root: string, id: string, draft: Record<string, unknown>): void {
  const file = join(customerDir(root, id), "customer.json");
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(draft, null, 2)}\n`, { flag: "wx" });
  try {
    renameSync(temp, file);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}

/** A new customer with no products and the default palette. Never overwrites a folder. */
export function createCustomer(root: string, input: unknown): CustomerConfig {
  if (!isRecord(input)) throw new PanelError("Nothing to create");
  const id = input.id;
  const invalid = checkCustomerId(id);
  if (invalid || typeof id !== "string") throw new PanelError(invalid ?? "A customer id is required");
  const errors: string[] = [];
  const name = readName(input.name, errors);
  if (errors.length > 0) throw new PanelError(errors.join(". "));

  // Windows folder names ignore case, so "Al-Amal" would be "al-amal"
  const taken = readdirSync(join(root, "customers")).find((entry) => entry.toLowerCase() === id);
  if (taken) throw new PanelError(`customers/${taken} already exists`);
  const dir = customerDir(root, id);
  try {
    mkdirSync(dir);
  } catch {
    throw new PanelError(`customers/${id} could not be created — does it exist already?`);
  }
  const config = { id, name, products: [], features: { themePaletteCustomization: false } };
  writeFileSync(join(dir, "customer.json"), `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
  return getCustomer(root, id);
}
