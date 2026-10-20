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

const OWN = {
  id: "own",
  name: { en: "Own", ar: "خاص" },
  products: ["billing"],
  extensions: {
    slots: { "visit.side-panel": "LoyaltyCard" },
    nav: [{ href: "/reports/x", icon: "report", section: "revenue", label: { en: "X", ar: "س" } }],
    routes: [{ path: "reports/x", export: "Report", title: { en: "X", ar: "س" } }],
  },
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
  });
  after(() => repo.cleanup());

  it("discovers every customer folder, editable or not", () => {
    const entries = listCustomers(repo.root);
    assert.deepEqual(entries.map((e) => e.id).sort(), ["broken", "locked", "moved", "own", "plain"]);
    const broken = entries.find((e) => e.id === "broken");
    assert.match(broken?.problem ?? "", /not valid JSON/);
    const moved = entries.find((e) => e.id === "moved");
    assert.match(moved?.problem ?? "", /"elsewhere", but the folder is "moved"/);
    assert.throws(() => getCustomer(repo.root, "moved"), /cannot be edited/);
    assert.throws(() => getCustomer(repo.root, "nobody"), /There is no customer "nobody"/);
  });

  it("reads a missing palette permission as not allowed", () => {
    assert.equal(getCustomer(repo.root, "plain").features.themePaletteCustomization, false);
    assert.equal(getCustomer(repo.root, "locked").features.themePaletteCustomization, true);
    const own = getCustomer(repo.root, "own");
    assert.deepEqual(own.extensions, { routes: ["reports/x"], nav: 1, slots: ["visit.side-panel"] });
    assert.equal(own.ownPackage, "@his/customer-own");
  });

  it("rejects ids that are not plain folder names", () => {
    for (const id of ["../x", "a/b", "a\\b", "A", "con", "nul", "-a", "a-", "", "x".repeat(41), ".", "%2e%2e", 7]) {
      assert.notEqual(checkCustomerId(id), null, `accepted ${JSON.stringify(id)}`);
    }
    for (const id of ["al-amal", "a", "clinic-2"]) assert.equal(checkCustomerId(id), null);
    assert.throws(() => customerDir(repo.root, "../../etc"), /customer id/);
  });

  it("saves name, products and the permission, and keeps everything else", () => {
    const parsed = parseEdit(
      { name: { en: " Own Hospital ", ar: "خاص" }, products: ["pharmacy"], features: { themePaletteCustomization: true } },
      readProducts(repo.root),
    );
    assert.ok(parsed.ok);
    writeCustomer(repo.root, "own", buildDraft(repo.root, "own", parsed.value));
    const saved = JSON.parse(repo.read("customers/own/customer.json"));
    assert.deepEqual(saved, {
      ...OWN,
      name: { en: "Own Hospital", ar: "خاص" },
      products: ["pharmacy"],
      features: { themePaletteCustomization: true },
    });
    assert.ok(repo.read("customers/own/customer.json").endsWith("}\n"));
    assert.ok(!existsSync(join(repo.root, `customers/own/customer.json.${process.pid}.tmp`)));
  });

  it("refuses edits that would not compose or are incomplete", () => {
    const catalog = readProducts(repo.root);
    const bad = parseEdit({ name: { en: "", ar: "x" }, products: ["billing", "billing", "radiology"], features: {} }, catalog);
    assert.ok(!bad.ok);
    assert.deepEqual(bad.errors, [
      "The English name is required",
      `"billing" is selected twice`,
      `"radiology" is not a product: no packages/*/his.product.json declares it`,
      `"Allow theme palette changes" must be on or off`,
    ]);
    assert.ok(!parseEdit({ name: { en: "a", ar: "b" }, products: "billing", features: { themePaletteCustomization: false } }, catalog).ok);
    assert.ok(parseEdit({ name: { en: "a", ar: "b" }, products: "*", features: { themePaletteCustomization: false } }, catalog).ok);
  });

  it("creates a customer once, with no products and the default palette", () => {
    const created = createCustomer(repo.root, { id: "new-one", name: { en: "New", ar: "جديد" } });
    assert.deepEqual(created.products, []);
    assert.equal(created.features.themePaletteCustomization, false);
    assert.deepEqual(JSON.parse(repo.read("customers/new-one/customer.json")), {
      id: "new-one",
      name: { en: "New", ar: "جديد" },
      products: [],
      features: { themePaletteCustomization: false },
    });
    assert.throws(() => createCustomer(repo.root, { id: "new-one", name: { en: "N", ar: "ج" } }), /already exists/);
    assert.throws(() => createCustomer(repo.root, { id: "../evil", name: { en: "N", ar: "ج" } }), /customer id/);
    assert.throws(() => createCustomer(repo.root, { id: "fine", name: { en: "N" } }), /Arabic name is required/);
    assert.ok(!existsSync(join(repo.root, "customers/fine")));
  });
});
