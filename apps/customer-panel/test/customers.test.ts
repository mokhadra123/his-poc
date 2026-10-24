import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  buildDraft,
  createCustomer,
  getCustomer,
  listCustomers,
  parseEdit,
  writeCustomer,
} from "../lib/server/customers.ts";
import { readProducts } from "../lib/server/products.ts";
import { checkCustomerId, customerDir } from "../lib/server/repo.ts";
import { type Fixture, makeRepo } from "./fixture.ts";

const EVERY_THEME = ["slate", "ink", "pine", "graphite", "custom", "original"];

const OWN = {
  id: "own",
  name: { en: "Own", ar: "خاص" },
  products: ["billing"],
  extensions: {
    slots: { "visit.side-panel": "LoyaltyCard" },
    nav: [{ href: "/reports/x", icon: "report", section: "revenue", label: { en: "X", ar: "س" } }],
    routes: [{ path: "reports/x", export: "Report", title: { en: "X", ar: "س" } }],
  },
  // the control app's: the panel shows them and writes them back untouched
  theme: { default: "pine", allowed: ["custom", "pine"], brand: "#1F6F8B" },
  features: { themePaletteCustomization: false },
  notes: "kept as is",
};

describe("customers", () => {
  let repo: Fixture;
  before(() => {
    repo = makeRepo();
    repo.write("customers/own/customer.json", OWN);
    repo.write("customers/own/package.json", { name: "@his/customer-own" });
    repo.write("customers/broken/customer.json", "{ not json");
    repo.write("customers/moved/customer.json", { id: "elsewhere", name: { en: "M", ar: "م" }, products: [] });
    repo.write("customers/locked/customer.json", {
      id: "locked",
      name: { en: "L", ar: "ل" },
      products: "*",
      features: { themePaletteCustomization: true },
    });
    repo.write("customers/neon/customer.json", {
      id: "neon",
      name: { en: "N", ar: "ن" },
      products: [],
      theme: { default: "neon", allowed: ["neon"], brand: null },
    });
  });
  after(() => repo.cleanup());

  it("discovers every customer folder, editable or not", () => {
    const entries = listCustomers(repo.root);
    assert.deepEqual(entries.map((e) => e.id).sort(), ["broken", "locked", "moved", "neon", "own", "plain"]);
    const broken = entries.find((e) => e.id === "broken");
    assert.match(broken?.problem ?? "", /not valid JSON/);
    const moved = entries.find((e) => e.id === "moved");
    assert.match(moved?.problem ?? "", /"elsewhere", but the folder is "moved"/);
    assert.throws(() => getCustomer(repo.root, "moved"), /cannot be edited/);
    assert.throws(() => getCustomer(repo.root, "nobody"), /There is no customer "nobody"/);
  });

  it("reads the themes, in @his/ui's order; without them, the older switch: missing = slate only, true = every theme", () => {
    const own = getCustomer(repo.root, "own");
    assert.deepEqual(own.theme, { default: "pine", allowed: ["pine", "custom"], brand: "#1f6f8b" });
    assert.equal(own.legacyTheme, false);
    assert.deepEqual(own.extensions, { routes: ["reports/x"], nav: 1, slots: ["visit.side-panel"] });
    assert.equal(own.ownPackage, "@his/customer-own");

    const plain = getCustomer(repo.root, "plain");
    assert.deepEqual(plain.theme, { default: "slate", allowed: ["slate"], brand: null });
    assert.equal(plain.legacyTheme, true);
    assert.deepEqual(getCustomer(repo.root, "locked").theme, { default: "slate", allowed: EVERY_THEME, brand: null });
  });

  it("lists a customer whose theme compose would refuse, but does not edit it", () => {
    const neon = listCustomers(repo.root).find((e) => e.id === "neon");
    assert.match(neon?.problem ?? "", /"theme\.allowed" has unknown themes: neon — fix it in the control app/);
    assert.throws(() => getCustomer(repo.root, "neon"), /cannot be edited/);
  });

  it("rejects ids that are not plain folder names", () => {
    for (const id of ["../x", "a/b", "a\\b", "A", "con", "nul", "-a", "a-", "", "x".repeat(41), ".", "%2e%2e", 7]) {
      assert.notEqual(checkCustomerId(id), null, `accepted ${JSON.stringify(id)}`);
    }
    for (const id of ["al-amal", "a", "clinic-2"]) assert.equal(checkCustomerId(id), null);
    assert.throws(() => customerDir(repo.root, "../../etc"), /customer id/);
  });

  it("saves name and products, and keeps everything else — theme and features too — in place", () => {
    // an older page still sends the palette switch: it is not part of the edit
    const parsed = parseEdit(
      { name: { en: " Own Hospital ", ar: "خاص" }, products: ["pharmacy"], features: { themePaletteCustomization: true } },
      readProducts(repo.root),
    );
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.value, { name: { en: "Own Hospital", ar: "خاص" }, products: ["pharmacy"] });
    writeCustomer(repo.root, "own", buildDraft(repo.root, "own", parsed.value));
    // compared as text: same keys, same order, 2-space JSON
    const expected = { ...OWN, name: { en: "Own Hospital", ar: "خاص" }, products: ["pharmacy"] };
    assert.equal(repo.read("customers/own/customer.json"), `${JSON.stringify(expected, null, 2)}\n`);
    assert.ok(!existsSync(join(repo.root, `customers/own/customer.json.${process.pid}.tmp`)));
  });

  it("refuses edits that would not compose or are incomplete", () => {
    const catalog = readProducts(repo.root);
    const bad = parseEdit({ name: { en: "", ar: "x" }, products: ["billing", "billing", "radiology"] }, catalog);
    assert.ok(!bad.ok);
    assert.deepEqual(bad.errors, [
      "The English name is required",
      `"billing" is selected twice`,
      `"radiology" is not a product: no packages/*/his.product.json declares it`,
    ]);
    assert.ok(!parseEdit({ name: { en: "a", ar: "b" }, products: "billing" }, catalog).ok);
    assert.ok(parseEdit({ name: { en: "a", ar: "b" }, products: "*" }, catalog).ok);
  });

  it("creates a customer once, with no products and the default theme only", () => {
    const created = createCustomer(repo.root, { id: "new-one", name: { en: "New", ar: "جديد" } });
    assert.deepEqual(created.products, []);
    assert.deepEqual(created.theme, { default: "slate", allowed: ["slate"], brand: null });
    assert.equal(created.legacyTheme, false);
    assert.deepEqual(JSON.parse(repo.read("customers/new-one/customer.json")), {
      id: "new-one",
      name: { en: "New", ar: "جديد" },
      products: [],
      theme: { default: "slate", allowed: ["slate"], brand: null },
    });
    assert.throws(() => createCustomer(repo.root, { id: "new-one", name: { en: "N", ar: "ج" } }), /already exists/);
    assert.throws(() => createCustomer(repo.root, { id: "../evil", name: { en: "N", ar: "ج" } }), /customer id/);
    assert.throws(() => createCustomer(repo.root, { id: "fine", name: { en: "N" } }), /Arabic name is required/);
    assert.ok(!existsSync(join(repo.root, "customers/fine")));
  });
});
