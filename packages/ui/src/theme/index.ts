import type { CSSProperties } from "react";

/*
 * Theme preferences live on <html> as attributes, so CSS alone decides
 * every colour and size. The server renders them from cookies, which means
 * the first paint is already correct — no flash, no client-side theme script.
 *
 *   data-theme    per hospital   slate | ink | pine | graphite | custom (| original)
 *   class="dark"  per user       light | dark
 *   data-density  per user       compact | comfortable
 *   data-nav      per user       expanded | collapsed
 *   data-rail     per user       open | collapsed
 *   data-palette  per customer   locked — the customer may not change the
 *                                palette (theme + brand), see lockPalette()
 *
 * The custom brand is always on <html> as --brand-custom (+ its derived
 * ink and text colours), whatever the active theme, so previews of the
 * custom theme follow it live.
 */

/** "original" reproduces HIS-frontend as it is today, for comparison — see tokens.css */
export const THEMES = ["slate", "ink", "pine", "graphite", "custom", "original"] as const;
export const MODES = ["light", "dark"] as const;
export const DENSITIES = ["compact", "comfortable"] as const;
export const NAV_STATES = ["expanded", "collapsed"] as const;
export const RAIL_STATES = ["open", "collapsed"] as const;

export type Theme = (typeof THEMES)[number];
export type Mode = (typeof MODES)[number];
export type Density = (typeof DENSITIES)[number];
export type NavState = (typeof NAV_STATES)[number];
export type RailState = (typeof RAIL_STATES)[number];

export type Prefs = {
  theme: Theme;
  mode: Mode;
  density: Density;
  nav: NavState;
  rail: RailState;
  brand: string;
};

export const DEFAULT_PREFS: Prefs = {
  theme: "slate",
  mode: "light",
  density: "compact",
  nav: "expanded",
  rail: "open",
  brand: "#7a3e9d",
};

export const PREF_COOKIES = {
  theme: "his-theme",
  mode: "his-mode",
  density: "his-density",
  nav: "his-nav",
  rail: "his-rail",
  brand: "his-brand",
} as const satisfies Record<keyof Prefs, string>;

const ALLOWED = {
  theme: THEMES,
  mode: MODES,
  density: DENSITIES,
  nav: NAV_STATES,
  rail: RAIL_STATES,
} as const;

const HEX = /^#[0-9a-f]{6}$/i;

/** The one validator: returns the value if it is allowed, otherwise undefined. */
export function parsePref<K extends keyof Prefs>(key: K, raw: string | null | undefined): Prefs[K] | undefined {
  if (raw == null) return undefined;
  if (key === "brand") return (HEX.test(raw) ? raw.toLowerCase() : undefined) as Prefs[K] | undefined;
  const allowed = ALLOWED[key as Exclude<keyof Prefs, "brand">] as readonly string[];
  return (allowed.includes(raw) ? raw : undefined) as Prefs[K] | undefined;
}

/** Validate raw cookie values; anything unknown falls back to the default. */
export function readPrefs(get: (name: string) => string | undefined): Prefs {
  const read = <K extends keyof Prefs>(key: K) => parsePref(key, get(PREF_COOKIES[key])) ?? DEFAULT_PREFS[key];
  return {
    theme: read("theme"),
    mode: read("mode"),
    density: read("density"),
    nav: read("nav"),
    rail: read("rail"),
    brand: read("brand"),
  };
}

/* ---------- palette permission ---------- */

/**
 * The prefs a hospital's palette is made of. A customer that may not change
 * its palette always gets the defaults for these; every other pref (mode,
 * density, nav, rail) stays the user's own.
 */
export const PALETTE_PREFS = ["theme", "brand"] as const satisfies readonly (keyof Prefs)[];
export type PalettePref = (typeof PALETTE_PREFS)[number];

export function isPalettePref(key: keyof Prefs): key is PalettePref {
  return (PALETTE_PREFS as readonly string[]).includes(key);
}

/** The prefs with the palette back at its defaults. Saved palette cookies are ignored, not deleted. */
export function lockPalette(prefs: Prefs): Prefs {
  return { ...prefs, theme: DEFAULT_PREFS.theme, brand: DEFAULT_PREFS.brand };
}

/* ---------- brand-derived colours ---------- */

const INK = "#0f1520";
const WHITE = "#ffffff";

function channels(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: string, b: string, t: number) {
  const ca = channels(a);
  const cb = channels(b);
  return `#${ca
    .map((c, i) => Math.round(c + (cb[i] - c) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Move `from` toward `to` in 5% steps until `ok` holds (or `to` is reached). */
function walk(from: string, to: string, ok: (c: string) => boolean) {
  let c = from;
  for (let t = 0.05; !ok(c) && t <= 1.0001; t += 0.05) c = mix(from, to, t);
  return c;
}

const AA = 4.6; // 4.5 plus a margin for oklab-vs-sRGB mixing in the browser
const LIGHT_SURFACES = [WHITE, "#fafbfc"];
const DARK_SURFACES = ["#151920", "#0d1015"];

/**
 * A hospital may pick any colour, so every colour that sits on or next to it
 * is MEASURED here rather than mixed at a fixed ratio:
 *   ink         text on the brand fill — white or ink, whichever contrasts more
 *   inkDim      secondary text on the brand band — as soft as 4.5:1 allows
 *   text        the brand as text on light surfaces and its own tint
 *   textDark    the brand as text on dark surfaces and its own tint
 *   fillDark    the fill in dark mode — lifted a little, but never past 4.5:1 with its ink
 *   hoverToward the hover moves away from the ink (or the other way, if that is invisible)
 *   fieldLine   the search field's border on the band, 3:1 against band and field
 *   edge        the primary button's border, 3:1 against the surface when the fill is not
 */
export function deriveBrand(brand: string) {
  const ink = contrast(brand, WHITE) >= contrast(brand, INK) ? WHITE : INK;
  const inkDim = walk(mix(ink, brand, 0.45), ink, (c) => contrast(c, brand) >= AA);
  const tint = mix(WHITE, brand, 0.1);
  const text = walk(brand, INK, (c) => [...LIGHT_SURFACES, tint].every((s) => contrast(c, s) >= AA));
  const darkTint = mix(DARK_SURFACES[0], brand, 0.24);
  const textDark = walk(mix(brand, WHITE, 0.5), WHITE, (c) =>
    [...DARK_SURFACES, darkTint].every((s) => contrast(c, s) >= AA),
  );
  const fillDark = walk(mix(brand, WHITE, 0.08), ink === WHITE ? "#000000" : WHITE, (c) => contrast(c, ink) >= AA);
  const away = ink === WHITE ? "#000000" : WHITE;
  const darkBand = mix("#0d1015", brand, 0.42); // sRGB estimate of the dark band
  const UI = 3; // non-text contrast for control boundaries
  return {
    ink,
    inkDim,
    text,
    textDark,
    fillDark,
    hoverToward: contrast(brand, away) < 1.2 ? (away === WHITE ? "#000000" : WHITE) : away,
    // a white field already stands out on a dark band; only a pale band needs a measured border
    fieldLine:
      contrast(WHITE, brand) >= UI
        ? mix(brand, "#000000", 0.18)
        : walk(brand, INK, (c) => contrast(c, brand) >= UI && contrast(c, WHITE) >= UI),
    fieldLineDark: walk(darkBand, WHITE, (c) => contrast(c, darkBand) >= UI && contrast(c, "#11151b") >= UI),
    edge: walk(brand, INK, (c) => contrast(c, WHITE) >= UI),
    edgeDark: walk(fillDark, WHITE, (c) => contrast(c, DARK_SURFACES[0]) >= UI),
    inkContrast: contrast(brand, ink),
    nearCritical: nearCritical(brand),
  };
}

/** A brand that could be mistaken for the clinical critical red. */
function nearCritical(hex: string) {
  const [r, g, b] = channels(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return false;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return (h < 18 || h > 342) && s > 0.4 && l > 0.25 && l < 0.65;
}

function brandVars(brand: string) {
  const d = deriveBrand(brand);
  return {
    "--brand-custom": brand,
    "--brand-custom-ink": d.ink,
    "--brand-custom-ink-dim": d.inkDim,
    "--brand-custom-text": d.text,
    "--brand-custom-text-dark": d.textDark,
    "--brand-custom-fill-dark": d.fillDark,
    "--brand-custom-hover-toward": d.hoverToward,
    "--brand-custom-field-line": d.fieldLine,
    "--brand-custom-field-line-dark": d.fieldLineDark,
    "--brand-custom-edge": d.edge,
    "--brand-custom-edge-dark": d.edgeDark,
  };
}

/**
 * Attributes for the server-rendered <html> element. With `paletteLocked`
 * (pass prefs through lockPalette() too) <html> says so, and setPref() then
 * refuses to change the palette.
 */
export function htmlThemeProps(prefs: Prefs, { paletteLocked = false }: { paletteLocked?: boolean } = {}) {
  return {
    className: prefs.mode === "dark" ? "dark" : undefined,
    "data-theme": prefs.theme,
    "data-density": prefs.density,
    "data-nav": prefs.nav,
    "data-rail": prefs.rail,
    "data-palette": paletteLocked ? "locked" : undefined,
    style: brandVars(prefs.brand) as CSSProperties,
  };
}

/**
 * Client side: apply one preference immediately and remember it.
 * Only touches <html>, so nothing re-renders. Invalid values are ignored,
 * and so is a palette change while <html data-palette="locked">.
 */
export function setPref<K extends keyof Prefs>(key: K, raw: Prefs[K]) {
  if (isPalettePref(key) && document.documentElement.dataset.palette === "locked") return;
  const value = parsePref(key, raw);
  if (value === undefined) return;
  const root = document.documentElement;
  if (key === "mode") {
    root.classList.toggle("dark", value === "dark");
  } else if (key === "brand") {
    for (const [name, v] of Object.entries(brandVars(value))) root.style.setProperty(name, v);
  } else {
    root.dataset[key] = value;
  }
  document.cookie = `${PREF_COOKIES[key]}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

/** Current value of a preference as <html> shows it right now. */
export function readHtmlPref<K extends "theme" | "mode" | "density" | "nav" | "rail">(key: K): Prefs[K] | undefined {
  const root = document.documentElement;
  if (key === "mode") return (root.classList.contains("dark") ? "dark" : "light") as Prefs[K];
  return parsePref(key, root.dataset[key]);
}
