import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalize, evaluateLicence, type LicencePayload } from "../src/index.ts";
import { generateSigningKey, signLicence, verifyLicence } from "../src/server.ts";

const payload: LicencePayload = {
  v: 1,
  kid: "k1",
  licenceId: "lic-1",
  customerId: "al-amal",
  customerName: { en: "Al-Amal Hospital", ar: "مستشفى الأمل" },
  installationId: "inst-1",
  issuedAt: "2026-01-01T09:00:00.000Z",
  expiresOn: "2026-12-31",
  warnDays: 30,
  graceDays: 14,
  products: ["billing"],
};

describe("canonicalize", () => {
  it("sorts keys at every level and drops undefined", () => {
    assert.equal(canonicalize({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } }), '{"a":{"d":[2,{"y":2,"z":1}]},"b":1}');
  });
});

describe("sign and verify", () => {
  const key = generateSigningKey("k1");
  const trusted = { keys: [{ kid: "k1", publicKey: key.publicKey, createdAt: "2026-01-01" }] };

  it("accepts what it signed, whatever the key order in the file", () => {
    const file = signLicence(payload, key.privateKey);
    const reordered = JSON.parse(JSON.stringify({ signature: file.signature, payload: { ...file.payload }, format: file.format }));
    const result = verifyLicence(reordered, trusted);
    assert.equal(result.ok, true);
  });

  it("refuses any changed field", () => {
    const file = signLicence(payload, key.privateKey);
    for (const change of [{ expiresOn: "2030-12-31" }, { products: ["billing", "pharmacy"] }, { graceDays: 365 }]) {
      const result = verifyLicence({ ...file, payload: { ...file.payload, ...change } }, trusted);
      assert.equal(result.ok, false);
      assert.equal(!result.ok && result.code, "bad-signature");
    }
  });

  it("refuses a key it does not trust, even a valid signature from it", () => {
    const other = generateSigningKey("k2");
    const file = signLicence({ ...payload, kid: "k2" }, other.privateKey);
    const result = verifyLicence(file, trusted);
    assert.equal(!result.ok && result.code, "unknown-key");
  });

  it("refuses a kid swapped to a trusted key", () => {
    const other = generateSigningKey("k2");
    const file = signLicence({ ...payload, kid: "k2" }, other.privateKey);
    const result = verifyLicence({ ...file, payload: { ...file.payload, kid: "k1" } }, trusted);
    assert.equal(!result.ok && result.code, "bad-signature");
  });

  it("refuses to sign a day that does not exist", () => {
    for (const expiresOn of ["2027-02-30", "2027-13-01", "2026-02-29"]) {
      assert.throws(() => signLicence({ ...payload, expiresOn }, key.privateKey), /expiresOn/);
    }
    assert.doesNotThrow(() => signLicence({ ...payload, expiresOn: "2028-02-29" }, key.privateKey));
  });

  it("reports a malformed file", () => {
    const result = verifyLicence({ format: "his-licence", payload: { v: 1 } }, trusted);
    assert.equal(!result.ok && result.code, "malformed");
  });
});

describe("evaluateLicence", () => {
  const at = (iso: string) => evaluateLicence(payload, { now: new Date(iso) });

  it("walks valid → warning → grace → read-only", () => {
    assert.equal(at("2026-12-01T12:00:00Z").state, "valid");
    assert.equal(at("2026-12-02T00:00:00Z").state, "warning"); // 30 days: 2 Dec … 31 Dec
    assert.equal(at("2026-12-31T23:59:59Z").state, "warning");
    assert.equal(at("2027-01-01T00:00:00Z").state, "grace");
    assert.equal(at("2027-01-14T23:00:00Z").state, "grace");
    const last = at("2027-01-15T00:00:00Z");
    assert.equal(last.state, "read-only");
    assert.equal(last.readOnly, true);
    assert.equal(last.timeline.readOnlyFrom, "2027-01-15");
  });

  it("counts days left and grace left", () => {
    assert.equal(at("2026-12-31T08:00:00Z").daysLeft, 0);
    const grace = at("2027-01-05T08:00:00Z");
    assert.equal(grace.daysLeft, -5);
    assert.equal(grace.graceDaysLeft, 9);
  });

  it("does not let a clock turned back extend the licence", () => {
    const result = evaluateLicence(payload, { now: new Date("2026-06-01T00:00:00Z"), seen: ["2027-02-01T00:00:00Z"] });
    assert.equal(result.state, "read-only");
    assert.equal(result.clockAdjusted, true);
  });

  it("uses the issue time as a floor for the clock", () => {
    const result = evaluateLicence(payload, { now: new Date("2020-01-01T00:00:00Z") });
    assert.equal(result.today, "2026-01-01");
    assert.equal(result.clockAdjusted, true);
  });

  it("ends a revoked licence on the revocation day, grace still applies", () => {
    const result = evaluateLicence(payload, { now: new Date("2026-03-05T00:00:00Z"), revokedOn: "2026-03-01" });
    assert.equal(result.state, "grace");
    assert.equal(result.timeline.readOnlyFrom, "2026-03-16");
  });
});
