import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { checkSelection, readProducts } from "../lib/server/products.ts";
import { type Fixture, makeRepo } from "./fixture.ts";

describe("products", () => {
  let repo: Fixture;
  before(() => {
    repo = makeRepo();
    repo.write("packages/broken/his.product.json", "{");
    repo.write("packages/nameless/his.product.json", { id: "nameless", package: "@his/nameless" });
    repo.write("packages/copy/his.product.json", { id: "billing", package: "@his/copy", name: { en: "c", ar: "c" } });
  });
  after(() => repo.cleanup());

  it("lists every his.product.json and reports the ones it cannot use", () => {
    const { products, problems } = readProducts(repo.root);
    assert.deepEqual(products.map((p) => p.id), ["billing", "pharmacy"]);
    const billing = products.find((p) => p.id === "billing");
    assert.deepEqual(billing?.routes, ["billing/invoices"]);
    assert.equal(billing?.package, "@his/billing");
    assert.equal(problems.length, 3);
    assert.ok(problems.some((p) => p.startsWith("packages/broken/his.product.json is not valid JSON")));
    assert.ok(problems.includes(`packages/nameless/his.product.json: "name" needs "en" and "ar"`));
    assert.ok(problems.some((p) => p.includes(`product id "billing" is already used`)));
  });

  it("accepts all products or known ids, and nothing else", () => {
    const catalog = readProducts(repo.root);
    assert.deepEqual(checkSelection("*", catalog), []);
    assert.deepEqual(checkSelection([], catalog), []);
    assert.deepEqual(checkSelection(["pharmacy", "billing"], catalog), []);
    assert.equal(checkSelection(["billing", "billing"], catalog).length, 1);
    assert.match(checkSelection(["lab"], catalog)[0] ?? "", /"lab" is not a product/);
    assert.match(checkSelection("billing", catalog)[0] ?? "", /must be "\*"/);
    assert.match(checkSelection([1], catalog)[0] ?? "", /are strings/);
  });
});
