/*
 * What the panel's server hands to the browser. Plain data only — no Node
 * imports — so client components can import these types.
 */

export type Localized = { en: string; ar: string };

/** "*" is every product in packages/, including ones added later */
export type ProductSelection = "*" | string[];

export type CustomerFeatures = {
  /** false (also when missing): the app keeps the default palette */
  themePaletteCustomization: boolean;
};

/** A product, from packages/<dir>/his.product.json */
export type Product = {
  id: string;
  package: string;
  name: Localized;
  routes: string[];
  nav: { href: string; section: string; label: Localized }[];
  slots: string[];
};

export type ProductCatalog = { products: Product[]; problems: string[] };

/** A customer, from customers/<id>/customer.json */
export type CustomerConfig = {
  id: string;
  name: Localized;
  products: ProductSelection;
  features: CustomerFeatures;
  /** what the customer adds itself — shown, never edited by the panel */
  extensions: { routes: string[]; nav: number; slots: string[] };
  /** the package of the customer's own code (customers/<id>/package.json) */
  ownPackage: string | null;
};

/** A customer folder: editable, or with the reason it is not */
export type CustomerEntry =
  | { id: string; config: CustomerConfig; problem: null }
  | { id: string; config: null; problem: string };

/** The part of customer.json the panel edits */
export type CustomerEdit = { name: Localized; products: ProductSelection; features: CustomerFeatures };

export type RunAction = "compose" | "start" | "stop";

export type RunStatus = {
  /** the operation in progress; only one at a time */
  busy: RunAction | null;
  /** the showcase this panel started */
  server: { customerId: string; url: string; ready: boolean } | null;
  /** what apps/showcase is composed for right now (products.generated.json) */
  composed: { customerId: string; themePaletteCustomization: boolean } | null;
  /** something this panel did not start listens on the showcase port */
  portInUse: boolean;
  port: number;
  last: { action: RunAction; customerId: string; ok: boolean; exitCode: number | null; message: string; at: string } | null;
  /** output of the last operation, newest last */
  output: string[];
};

export type ActionResult = { ok: true; message: string } | { ok: false; error: string; output?: string };
