/*
 * What the composed customer may change (customer.json → "features", written
 * by scripts/compose.mjs). Kept apart from i18n.ts so the proxy can import it
 * without next/headers.
 */
import { CUSTOMER } from "./products.generated";

/** No palette permission: the default theme and brand, no theme switch, ?theme= links ignored. */
export const PALETTE_LOCKED = !CUSTOMER.features.themePaletteCustomization;
