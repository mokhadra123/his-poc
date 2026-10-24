/*
 * Server only (node:crypto). The control plane signs; every build verifies
 * with the public keys it was composed with (trusted-keys.json), never with a
 * key file lying next to the licence — a customer who can replace both could
 * sign a licence for themselves.
 */
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { canonicalize, LICENCE_FORMAT, type LicenceFile, type LicencePayload, licenceShapeProblems } from "./payload.ts";

export type TrustedKey = { kid: string; publicKey: string; createdAt: string };
export type TrustedKeys = { keys: TrustedKey[] };

export type VerifyResult =
  | { ok: true; payload: LicencePayload }
  | { ok: false; code: "malformed" | "unknown-key" | "bad-signature"; reason: string; payload?: LicencePayload };

export function generateSigningKey(kid: string) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    kid,
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

export function signLicence(payload: LicencePayload, privateKeyPem: string): LicenceFile {
  const problems = licenceShapeProblems({ format: LICENCE_FORMAT, payload, signature: "x".repeat(20) });
  if (problems.length) throw new Error(`Refusing to sign a malformed licence: ${problems.join("; ")}`);
  const signature = sign(null, Buffer.from(canonicalize(payload)), createPrivateKey(privateKeyPem)).toString("base64");
  return { format: LICENCE_FORMAT, payload, signature };
}

/** Checks the shape, finds the key by payload.kid among the trusted ones, and checks the signature. */
export function verifyLicence(file: unknown, trusted: TrustedKeys): VerifyResult {
  const problems = licenceShapeProblems(file);
  if (problems.length) return { ok: false, code: "malformed", reason: `The licence file is malformed: ${problems.join("; ")}` };
  const { payload, signature } = file as LicenceFile;
  const key = trusted.keys.find((k) => k.kid === payload.kid);
  if (!key) {
    return {
      ok: false,
      code: "unknown-key",
      reason: `The licence is signed with key "${payload.kid}", which this build does not trust`,
      payload,
    };
  }
  let valid = false;
  try {
    valid = verify(null, Buffer.from(canonicalize(payload)), createPublicKey(key.publicKey), Buffer.from(signature, "base64"));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, code: "bad-signature", reason: "The licence signature does not match its contents", payload };
  return { ok: true, payload };
}

/** A short fingerprint of a public key, for people comparing keys. */
export function keyFingerprint(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({ type: "spki", format: "der" });
  const raw = der.subarray(der.length - 32);
  return raw.toString("hex").slice(0, 16).replace(/(.{4})(?!$)/g, "$1:");
}
