/*
 * The real scripts/compose.mjs, copied into a throwaway repository: what it
 * writes for the palette permission, and that --check and a failed compose
 * leave the generated output alone.
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

describe("compose.mjs", () => {
  let repo: Fixture;
  beforeEach(() => {
    repo = makeRepo({ realCompose: true });
  });
  afterEach(() => repo.cleanup());

  it("treats a missing permission as default only, and passes true through", async () => {
    const plain = await runCompose(repo.root, "plain");
    assert.equal(plain.exitCode, 0, plain.output);
    assert.match(plain.output, /composed "plain" .*theme palette = default only/);
    assert.deepEqual(composed(repo).features, { themePaletteCustomization: false });
    assert.match(repo.read("apps/showcase/lib/products.generated.ts"), /"features":\{"themePaletteCustomization":false\}/);

    repo.write("customers/free/customer.json", {
      id: "free",
      name: { en: "Free", ar: "حر" },
      products: "*",
      features: { themePaletteCustomization: true },
    });
    const free = await runCompose(repo.root, "free");
    assert.equal(free.exitCode, 0, free.output);
    assert.deepEqual(composed(repo).features, { themePaletteCustomization: true });
    assert.deepEqual(composed(repo).enabled.map((u: { id: string }) => u.id), ["billing", "pharmacy"]);
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
