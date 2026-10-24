/*
 * What the composed customer may change (customer.json → "theme", written by
 * scripts/compose.mjs). Kept apart from i18n.ts so the proxy can import it
 * without next/headers.
 */
import { themeChoices } from "@his/ui/theme";
import { CUSTOMER } from "./products.generated";

/** The customer's themes: its default, the ones users may switch between, and its own brand colour. */
export const THEME_POLICY = CUSTOMER.theme;

/** What a user may still change: the themes to switch between (none when there is one) and the custom colour. */
export const THEME_CHOICES = themeChoices(THEME_POLICY);
