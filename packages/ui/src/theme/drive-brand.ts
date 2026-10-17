import type { CSSProperties } from "react";
import type { Prefs } from ".";

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

/** Attributes for the server-rendered <html> element. */
export function htmlThemeProps(prefs: Prefs) {
    return {
      className: prefs.mode === "dark" ? "dark" : undefined,
      "data-theme": prefs.theme,
      "data-density": prefs.density,
      "data-nav": prefs.nav,
      "data-rail": prefs.rail,
      style: brandVars(prefs.brand) as CSSProperties,
    };
  }