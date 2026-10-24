/*
 * The real scripts/compose.mjs, copied into a throwaway repository: what it
 * writes for a customer's themes (and the older palette switch), and that
 * --check and a failed compose leave the generated output alone.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { checkDraft, runCompose } from "../lib/server/compose.ts";
import { type Fixture, makeRepo } from "./fixture.ts";

const GENERATED = "apps/showcase/products.generated.json";
const composed = (repo: Fixture) => JSON.parse(repo.read(GENERATED));
const EVERY_THEME = ["slate", "ink", "pine", "graphite", "custom", "original"];
const customer = (id: string, theme: unknown, extra: Record<string, unknown> = {}) => ({
  id,
  name: { en: id, ar: "ع" },
  products: [],
  theme,
  ...extra,
});

describe("compose.mjs", () => {
  let repo: Fixture;
  beforeEach(() => {
    repo = makeRepo({ realCompose: true });
  });
  afterEach(() => repo.cleanup());

  it("reads the older switch without a theme: missing = slate only, true = every theme", async () => {
    const plain = await runCompose(repo.root, "plain");
    assert.equal(plain.exitCode, 0, plain.output);
    assert.match(plain.output, /composed "plain" .*theme = slate only$/m);
    assert.deepEqual(composed(repo).theme, { default: "slate", allowed: ["slate"], brand: null });
    assert.deepEqual(composed(repo).features, { themePaletteCustomization: false });
    assert.match(
      repo.read("apps/showcase/lib/products.generated.ts"),
      /"features":\{"themePaletteCustomization":false\},"theme":\{"default":"slate","allowed":\["slate"\],"brand":null\}/,
    );

    repo.write("customers/free/customer.json", {
      id: "free",
      name: { en: "Free", ar: "حر" },
      products: "*",
      features: { themePaletteCustomization: true },
    });
    const free = await runCompose(repo.root, "free");
    assert.equal(free.exitCode, 0, free.output);
    assert.match(free.output, /theme = slate \(users switch between slate, ink, pine, graphite, custom, original\)$/m);
    assert.deepEqual(composed(repo).theme, { default: "slate", allowed: EVERY_THEME, brand: null });
    assert.deepEqual(composed(repo).features, { themePaletteCustomization: true });
    assert.deepEqual(composed(repo).enabled.map((u: { id: string }) => u.id), ["billing", "pharmacy"]);
  });

  it("writes a customer's theme, in @his/ui's order, and derives the palette flag from it", async () => {
    // "theme" wins over the older switch
    repo.write(
      "customers/two/customer.json",
      customer("two", { default: "pine", allowed: ["custom", "pine"], brand: "#1F6F8B" }, { features: { themePaletteCustomization: false } }),
    );
    const two = await runCompose(repo.root, "two");
    assert.equal(two.exitCode, 0, two.output);
    assert.match(two.output, /theme = pine \(users switch between pine, custom\), brand #1f6f8b$/m);
    assert.deepEqual(composed(repo).theme, { default: "pine", allowed: ["pine", "custom"], brand: "#1f6f8b" });
    assert.deepEqual(composed(repo).features, { themePaletteCustomization: true });
    assert.match(
      repo.read("apps/showcase/lib/products.generated.ts"),
      /"theme":\{"default":"pine","allowed":\["pine","custom"\],"brand":"#1f6f8b"\}/,
    );

    // may its users change anything? one theme with nothing to pick is a fixed look
    const flags: [unknown, boolean][] = [
      [{ default: "pine", allowed: ["pine"], brand: null }, false],
      [{ allowed: ["custom"], brand: "#1f6f8b" }, false],
      [{ allowed: ["custom"], brand: null }, true],
      [{ allowed: ["graphite", "ink"] }, true],
    ];
    for (const [theme, changeable] of flags) {
      repo.write("customers/one/customer.json", customer("one", theme, { features: { themePaletteCustomization: !changeable } }));
      const one = await runCompose(repo.root, "one");
      assert.equal(one.exitCode, 0, one.output);
      assert.equal(composed(repo).features.themePaletteCustomization, changeable, JSON.stringify(theme));
    }
    // no default: the first one listed
    assert.deepEqual(composed(repo).theme, { default: "graphite", allowed: ["ink", "graphite"], brand: null });
  });

  it("refuses an unknown theme, a default it does not allow, and a bad brand", async () => {
    const refused: [unknown, RegExp][] = [
      [{ default: "slate", allowed: ["slate", "neon"], brand: null }, /"theme"\.allowed has unknown themes: neon/],
      [{ default: "ink", allowed: ["slate", "pine"], brand: null }, /"theme"\.default "ink" is not one of the allowed themes/],
      [{ default: "custom", allowed: ["custom"], brand: "teal" }, /"theme"\.brand must be a colour like "#1f6f8b"/],
      [{ default: "custom", allowed: ["custom"], brand: "#1f6f8" }, /"theme"\.brand must be a colour/],
      [{ default: "slate", allowed: [], brand: null }, /"theme"\.allowed must list at least one theme/],
    ];
    for (const [theme, message] of refused) {
      const result = await checkDraft(repo.root, "plain", customer("plain", theme));
      assert.equal(result.exitCode, 1, JSON.stringify(theme));
      assert.match(result.output, message);
    }
    repo.write("customers/neon/customer.json", customer("neon", { allowed: ["neon"] }));
    const neon = await runCompose(repo.root, "neon");
    assert.equal(neon.exitCode, 1);
    assert.ok(!existsSync(join(repo.root, GENERATED)), "nothing written");
  });

  it("rejects a permission that is not true or false, or a misspelt one", async () => {
    repo.write("customers/odd/customer.json", {
      id: "odd",
      name: { en: "Odd", ar: "غريب" },
      products: [],
      features: { themePaletteCustomization: "yes" },
    });
    const odd = await runCompose(repo.root, "odd");
    assert.equal(odd.exitCode, 1);
    assert.match(odd.output, /feature "themePaletteCustomization" must be true or false/);
    assert.ok(!existsSync(join(repo.root, GENERATED)));

    const typo = await checkDraft(repo.root, "plain", {
      id: "plain",
      name: { en: "P", ar: "ع" },
      products: [],
      features: { themePalleteCustomization: true },
    });
    assert.equal(typo.exitCode, 1);
    assert.match(typo.output, /unknown feature "themePalleteCustomization"/);
  });

  it("--check and a draft write nothing", async () => {
    const drafts = () => readdirSync(tmpdir()).filter((d) => d.startsWith("his-panel-") && !d.startsWith("his-panel-test-"));
    const before = drafts();
    const draft = await checkDraft(repo.root, "plain", { id: "plain", name: { en: "P", ar: "ع" }, products: ["pharmacy"] });
    assert.equal(draft.exitCode, 0, draft.output);
    assert.match(draft.output, /checked "plain" \(P\): in = \[pharmacy\].*nothing written/);
    assert.ok(!existsSync(join(repo.root, GENERATED)));
    assert.ok(!existsSync(join(repo.root, "apps/showcase/app/(app)/(composed)")));
    assert.deepEqual(drafts(), before, "the draft's temp folder is removed");
  });

  it("a route conflict fails before anything is written", async () => {
    assert.equal((await runCompose(repo.root, "plain")).exitCode, 0);
    const before = {
      json: repo.read(GENERATED),
      shell: repo.read("apps/showcase/app/(app)/(composed)/billing/invoices/page.tsx"),
    };
    repo.write("customers/clash/package.json", { name: "@his/customer-clash" });
    repo.write("customers/clash/customer.json", {
      id: "clash",
      name: { en: "Clash", ar: "تعارض" },
      products: ["billing"],
      extensions: { routes: [{ path: "billing/invoices", export: "Mine", title: { en: "M", ar: "م" } }] },
    });
    const clash = await runCompose(repo.root, "clash");
    assert.equal(clash.exitCode, 1);
    assert.match(clash.output, /\/billing\/invoices is claimed by both @his\/billing and @his\/customer-clash/);
    assert.equal(repo.read(GENERATED), before.json);
    assert.equal(repo.read("apps/showcase/app/(app)/(composed)/billing/invoices/page.tsx"), before.shell);
  });
});
