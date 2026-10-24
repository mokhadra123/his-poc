/*
 * The contract every product package's his.product.json follows; a
 * customer's own pages (customers/<id>/customer.json → "extensions") use the
 * same shape. scripts/compose.mjs reads both to generate routes and nav.
 */
import type { ThemePolicy } from "@his/ui/theme";

type L = { en: string; ar: string };

export type ProductManifest = {
  id: string;
  package: string;
  name: L;
  // section: care | revenue | setup | system (a string, since JSON imports are not literal-typed)
  nav: { href: string; icon: string; section: string; label: L }[];
  routes: { path: string; export: string; title: L }[];
};

/** The customer a build is composed for, and what it may change in the app (customer.json → "theme", "features"). */
export type ComposedCustomer = {
  id: string;
  name: L;
  features: {
    /** derived from `theme`: may its users change anything at all (verify-build, the customer panel) */
    themePaletteCustomization: boolean;
  };
  /** the customer's themes, set in the control app; ThemePolicy keeps compose's theme names honest */
  theme: ThemePolicy;
};
