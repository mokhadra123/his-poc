/*
 * How the panel names a customer's themes. Plain data, for client
 * components; the names follow the control app, where themes are edited.
 */
import type { Theme, ThemePolicy } from "@his/ui/theme";

export const THEME_LABELS: Record<Theme, string> = {
  slate: "Slate",
  ink: "Ink",
  pine: "Pine",
  graphite: "Graphite",
  custom: "Hospital colour",
  original: "HIS today",
};

/** Where the theme is edited: the customer's Appearance tab in the control app (npm run control). */
export const controlAppearanceUrl = (customerId: string) =>
  `http://127.0.0.1:3300/customers/${encodeURIComponent(customerId)}/appearance`;

/** A few words for a list: "Slate only", "3 themes". */
export function themeCount(theme: ThemePolicy) {
  return theme.allowed.length === 1 ? `${THEME_LABELS[theme.default]} only` : `${theme.allowed.length} themes`;
}

/** One line, as compose sums it up: "Pine (users switch between Pine, Hospital colour), brand #1f6f8b". */
export function themeSummary(theme: ThemePolicy) {
  const start =
    theme.allowed.length === 1
      ? `${THEME_LABELS[theme.default]} only`
      : `${THEME_LABELS[theme.default]} (users switch between ${theme.allowed.map((t) => THEME_LABELS[t]).join(", ")})`;
  return theme.brand ? `${start}, brand ${theme.brand}` : start;
}
