/*
 * A customer's themes in @his/ui/theme: the server keeps saved prefs inside
 * the customer's policy (applyThemePolicy, or lockPalette for the older
 * switch), and the client API refuses what <html> does not allow —
 * data-palette="locked", data-themes, data-brand="locked". Every other pref
 * stays the user's.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  applyThemePolicy,
  DEFAULT_PREFS,
  htmlThemeProps,
  lockPalette,
  OPEN_THEME_POLICY,
  readPrefs,
  setPref,
  type ThemePolicy,
  themeChoices,
} from "@his/ui/theme";

const SAVED = {
  "his-theme": "pine",
  "his-brand": "#aa3355",
  "his-mode": "dark",
  "his-density": "comfortable",
  "his-nav": "collapsed",
  "his-rail": "collapsed",
};

/** just enough of `document` for setPref; `html` adds attributes to <html> (as dataset keys) */
function fakeDocument(palette?: "locked", html: { themes?: string; brand?: "locked" } = {}) {
  const dataset: Record<string, string> = { theme: "slate", density: "compact", ...html };
  if (palette) dataset.palette = palette;
  const classes = new Set<string>();
  const cookies: string[] = [];
  const doc = {
    documentElement: {
      dataset,
      classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
      style: { setProperty: (name: string, value: string) => (dataset[`style:${name}`] = value) },
    },
    set cookie(value: string) {
      cookies.push(value);
    },
  };
  Object.defineProperty(globalThis, "document", { value: doc, configurable: true });
  return { dataset, classes, cookies };
}

const policy = (theme: Partial<ThemePolicy> & Pick<ThemePolicy, "allowed">): ThemePolicy => ({
  default: theme.allowed[0],
  brand: null,
  ...theme,
});
const cookieNames = (cookies: string[]) => cookies.map((c) => c.split("=")[0]);

describe("palette permission", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
  });

  it("lockPalette drops a saved theme and brand and keeps everything else", () => {
    const saved = readPrefs((name) => SAVED[name as keyof typeof SAVED]);
    assert.equal(saved.theme, "pine");
    assert.deepEqual(lockPalette(saved), {
      theme: DEFAULT_PREFS.theme,
      brand: DEFAULT_PREFS.brand,
      mode: "dark",
      density: "comfortable",
      nav: "collapsed",
      rail: "collapsed",
    });
  });

  it("htmlThemeProps marks <html> only when locked", () => {
    assert.equal(htmlThemeProps(DEFAULT_PREFS)["data-palette"], undefined);
    assert.equal(htmlThemeProps(DEFAULT_PREFS, { paletteLocked: false })["data-palette"], undefined);
    assert.equal(htmlThemeProps(DEFAULT_PREFS, { paletteLocked: true })["data-palette"], "locked");
  });

  it("setPref refuses theme and brand while locked, and still sets the rest", () => {
    const { dataset, classes, cookies } = fakeDocument("locked");
    setPref("theme", "pine");
    setPref("brand", "#aa3355");
    assert.equal(dataset.theme, "slate");
    assert.equal(dataset["style:--brand-custom"], undefined);
    assert.equal(cookies.length, 0, "no palette cookie written");

    setPref("density", "comfortable");
    setPref("mode", "dark");
    assert.equal(dataset.density, "comfortable");
    assert.ok(classes.has("dark"));
    assert.deepEqual(cookies.map((c) => c.split("=")[0]), ["his-density", "his-mode"]);
  });

  it("setPref changes the palette when it is not locked", () => {
    const { dataset, cookies } = fakeDocument();
    setPref("theme", "pine");
    setPref("brand", "#aa3355");
    assert.equal(dataset.theme, "pine");
    assert.equal(dataset["style:--brand-custom"], "#aa3355");
    assert.deepEqual(cookies.map((c) => c.split("=")[0]), ["his-theme", "his-brand"]);
  });
});

describe("theme policy", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
  });

  it("applyThemePolicy falls back to the default for a saved theme the customer does not have", () => {
    const saved = readPrefs((name) => SAVED[name as keyof typeof SAVED]); // pine, #aa3355
    const twoThemes = policy({ default: "ink", allowed: ["slate", "ink"] });
    assert.deepEqual(applyThemePolicy(saved, twoThemes), { ...saved, theme: "ink" });
    // an allowed saved theme stays, and so does the user's colour while the hospital has none
    assert.deepEqual(applyThemePolicy(saved, policy({ default: "slate", allowed: ["slate", "pine"] })), saved);
    // the hospital's colour replaces the user's
    assert.deepEqual(applyThemePolicy(saved, policy({ allowed: ["custom"], brand: "#1f6f8b" })), {
      ...saved,
      theme: "custom",
      brand: "#1f6f8b",
    });
    assert.deepEqual(applyThemePolicy(saved, OPEN_THEME_POLICY), saved);
  });

  it("themeChoices: themes to switch only when there are several, a colour only when the hospital has none", () => {
    assert.deepEqual(themeChoices(policy({ allowed: ["pine"] })), { themes: [], pickBrand: false });
    assert.deepEqual(themeChoices(policy({ allowed: ["pine", "custom"] })), { themes: ["pine", "custom"], pickBrand: true });
    assert.deepEqual(themeChoices(policy({ allowed: ["pine", "custom"], brand: "#1f6f8b" })), {
      themes: ["pine", "custom"],
      pickBrand: false,
    });
    assert.deepEqual(themeChoices(policy({ allowed: ["custom"] })), { themes: [], pickBrand: true });
  });

  it("htmlThemeProps marks <html> with the themes, the brand lock, and a lock when nothing is left to choose", () => {
    const props = (p: ThemePolicy) => {
      const html = htmlThemeProps(applyThemePolicy(DEFAULT_PREFS, p), { policy: p });
      return { theme: html["data-theme"], themes: html["data-themes"], brand: html["data-brand"], palette: html["data-palette"] };
    };
    assert.deepEqual(props(OPEN_THEME_POLICY), { theme: "slate", themes: undefined, brand: undefined, palette: undefined });
    assert.deepEqual(props(policy({ default: "custom", allowed: ["pine", "custom"], brand: "#1f6f8b" })), {
      theme: "custom",
      themes: "pine custom",
      brand: "locked",
      palette: undefined,
    });
    assert.deepEqual(props(policy({ allowed: ["pine"] })), { theme: "pine", themes: "pine", brand: undefined, palette: "locked" });
    assert.deepEqual(props(policy({ allowed: ["custom"], brand: "#1f6f8b" })), {
      theme: "custom",
      themes: "custom",
      brand: "locked",
      palette: "locked",
    });
    // one theme, but its colour is the user's to pick
    assert.equal(props(policy({ allowed: ["custom"] })).palette, undefined);
    // the hospital's colour is on <html> whatever the active theme, so a switch to custom shows it at once
    const hospital = policy({ allowed: ["slate", "custom"], brand: "#1f6f8b" });
    const html = htmlThemeProps(applyThemePolicy(DEFAULT_PREFS, hospital), { policy: hospital });
    assert.equal(html["data-theme"], "slate");
    assert.equal((html.style as unknown as Record<string, string>)["--brand-custom"], "#1f6f8b");
  });

  it("setPref switches only between the themes in data-themes", () => {
    const { dataset, cookies } = fakeDocument(undefined, { themes: "pine custom" });
    setPref("theme", "ink");
    setPref("theme", "original");
    assert.equal(dataset.theme, "slate");
    assert.equal(cookies.length, 0, "no cookie for a theme the customer does not have");

    setPref("theme", "custom");
    setPref("brand", "#aa3355");
    setPref("theme", "pine");
    assert.equal(dataset.theme, "pine");
    assert.equal(dataset["style:--brand-custom"], "#aa3355");
    assert.deepEqual(cookieNames(cookies), ["his-theme", "his-brand", "his-theme"]);
  });

  it("setPref keeps the hospital's colour while data-brand is locked, and still switches themes", () => {
    const { dataset, cookies } = fakeDocument(undefined, { themes: "slate custom", brand: "locked" });
    setPref("brand", "#aa3355");
    assert.equal(dataset["style:--brand-custom"], undefined);
    setPref("theme", "custom");
    setPref("mode", "dark");
    assert.equal(dataset.theme, "custom");
    assert.deepEqual(cookieNames(cookies), ["his-theme", "his-mode"]);
  });
});
