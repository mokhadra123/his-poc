/*
 * The palette permission in @his/ui/theme: the server ignores saved palette
 * prefs (lockPalette), and the client API refuses to change them while
 * <html data-palette="locked">. Every other pref stays the user's.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { DEFAULT_PREFS, htmlThemeProps, lockPalette, readPrefs, setPref } from "@his/ui/theme";

const SAVED = {
  "his-theme": "pine",
  "his-brand": "#aa3355",
  "his-mode": "dark",
  "his-density": "comfortable",
  "his-nav": "collapsed",
  "his-rail": "collapsed",
};

/** just enough of `document` for setPref */
function fakeDocument(palette?: "locked") {
  const dataset: Record<string, string> = { theme: "slate", density: "compact" };
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
