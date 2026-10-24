/*
 * The licence file: the contract between the control plane that issues it
 * and every HIS build that checks it. Plain data only, so it can be imported
 * anywhere (client components included). Signing and verifying need
 * node:crypto and live in ./server.
 *
 * The signature covers canonical(payload), and the key id is inside the
 * payload, so neither the key choice nor any field can be changed without
 * breaking the signature.
 */

export type Localized = { en: string; ar: string };

export type LicencePayload = {
  /** payload format version */
  v: 1;
  /** which signing key; lets the control plane rotate keys without breaking issued licences */
  kid: string;
  licenceId: string;
  customerId: string;
  customerName: Localized;
  /** the one deployment this licence is for (a customer may have several: production, test …) */
  installationId: string;
  /** ISO date-time. Also a floor for the clock: a licence proves "now" is at least this. */
  issuedAt: string;
  /** YYYY-MM-DD, the last day the licence is fully valid (inclusive, UTC) */
  expiresOn: string;
  /** a warning is shown this many days before expiresOn */
  warnDays: number;
  /** after expiresOn the installation keeps working this many days, then turns read-only */
  graceDays: number;
  /** product ids from the catalog (packages/<p>/his.product.json → id), sorted; core is always in */
  products: string[];
};

export type LicenceFile = {
  format: "his-licence";
  payload: LicencePayload;
  /** base64 Ed25519 signature over canonical(payload) */
  signature: string;
};

export const LICENCE_FORMAT = "his-licence";

/** Stable JSON: object keys sorted at every level, no whitespace. Both sides sign/verify these bytes. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** a day that exists: V8 parses 2027-02-30 as 2 March, so the date must come back unchanged */
export const isDay = (v: unknown): v is string => {
  if (typeof v !== "string" || !DAY.test(v)) return false;
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
};
const isCount = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;

/**
 * Shape check of an untrusted licence file (before the signature is checked).
 * Returns the problems; an empty list means the shape is right.
 */
export function licenceShapeProblems(file: unknown): string[] {
  if (!isRecord(file)) return ["not a JSON object"];
  const problems: string[] = [];
  if (file.format !== LICENCE_FORMAT) problems.push(`"format" must be "${LICENCE_FORMAT}"`);
  if (typeof file.signature !== "string" || file.signature.length < 20) problems.push(`"signature" is missing`);
  const p = file.payload;
  if (!isRecord(p)) return [...problems, `"payload" is missing`];
  if (p.v !== 1) problems.push(`unsupported payload version ${JSON.stringify(p.v)}`);
  for (const key of ["kid", "licenceId", "customerId", "installationId"] as const) {
    if (typeof p[key] !== "string" || !ID.test(p[key] as string)) problems.push(`"${key}" is missing or malformed`);
  }
  const name = p.customerName;
  if (!isRecord(name) || typeof name.en !== "string" || typeof name.ar !== "string") problems.push(`"customerName" needs en and ar`);
  if (typeof p.issuedAt !== "string" || Number.isNaN(Date.parse(p.issuedAt))) problems.push(`"issuedAt" is not a date-time`);
  if (!isDay(p.expiresOn)) problems.push(`"expiresOn" is not a YYYY-MM-DD date`);
  if (!isCount(p.warnDays, 365)) problems.push(`"warnDays" must be 0–365`);
  if (!isCount(p.graceDays, 365)) problems.push(`"graceDays" must be 0–365`);
  if (!Array.isArray(p.products) || !p.products.every((id) => typeof id === "string" && ID.test(id))) {
    problems.push(`"products" must be a list of product ids`);
  }
  return problems;
}

/** The file as the control plane hands it out: 2-space JSON, payload keys in canonical order. */
export function formatLicenceFile(file: LicenceFile): string {
  const payload = JSON.parse(canonicalize(file.payload)) as LicencePayload;
  return `${JSON.stringify({ format: file.format, payload, signature: file.signature }, null, 2)}\n`;
}
