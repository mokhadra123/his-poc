/*
 * The contract every product package's his.product.json follows; a
 * customer's own pages (customers/<id>/customer.json → "extensions") use the
 * same shape. scripts/compose.mjs reads both to generate routes and nav.
 */
type L = { en: string; ar: string };

export type ProductManifest = {
  id: string;
  package: string;
  name: L;
  // section: care | revenue | setup | system (a string, since JSON imports are not literal-typed)
  nav: { href: string; icon: string; section: string; label: L }[];
  routes: { path: string; export: string; title: L }[];
};

/** The customer a build is composed for, and what it may change in the app (customer.json → "features"). */
export type ComposedCustomer = {
  id: string;
  name: L;
  features: {
    /** false (the default): the app keeps the default palette and offers no theme switch */
    themePaletteCustomization: boolean;
  };
};
