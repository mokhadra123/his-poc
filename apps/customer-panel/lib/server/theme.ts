/*
 * A customer's themes (customer.json → "theme"), read the way compose reads
 * them. They are set in the control app; the panel only shows them. Without
 * "theme", the older features.themePaletteCustomization keeps its meaning:
 * true = every theme, false or missing = the default (slate) only.
 */
import { DEFAULT_PREFS, THEMES, type Theme, type ThemePolicy } from "@his/ui/theme";
import { isRecord } from "./repo.ts";

const HEX = /^#[0-9a-f]{6}$/i;

const isTheme = (name: unknown): name is Theme => (THEMES as readonly unknown[]).includes(name);

/**
 * The themes in a customer.json (or products.generated.json), or why they
 * cannot be read. `legacy`: read from the older on/off switch.
 */
export function readTheme(raw: Record<string, unknown>): { theme: ThemePolicy; legacy: boolean } | string {
  const t = raw.theme;
  if (t === undefined) {
    const features = isRecord(raw.features) ? raw.features : {};
    const open = features.themePaletteCustomization === true;
    return {
      theme: { default: DEFAULT_PREFS.theme, allowed: open ? [...THEMES] : [DEFAULT_PREFS.theme], brand: null },
      legacy: true,
    };
  }
  if (!isRecord(t)) return `"theme" must be an object`;
  const allowed: unknown[] = Array.isArray(t.allowed) ? t.allowed : [];
  if (allowed.length === 0) return `"theme.allowed" must list at least one theme`;
  const unknown = allowed.filter((name) => !isTheme(name));
  if (unknown.length) return `"theme.allowed" has unknown themes: ${unknown.map(String).join(", ")}`;
  if (new Set(allowed).size !== allowed.length) return `"theme.allowed" lists a theme twice`;
  const fallback = t.default ?? allowed[0];
  if (!isTheme(fallback) || !allowed.includes(fallback)) {
    return `"theme.default" ${JSON.stringify(fallback)} is not one of the allowed themes`;
  }
  const brand = t.brand ?? null;
  if (brand !== null && (typeof brand !== "string" || !HEX.test(brand))) return `"theme.brand" must be a colour like "#1f6f8b"`;
  return {
    // @his/ui's order, as compose writes it
    theme: { default: fallback, allowed: THEMES.filter((name) => allowed.includes(name)), brand: brand?.toLowerCase() ?? null },
    legacy: false,
  };
}
