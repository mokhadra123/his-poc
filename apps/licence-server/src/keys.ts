import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ControlUser, SigningKey } from "@his/licence/api";
import { generateSigningKey, keyFingerprint, type TrustedKeys } from "@his/licence/server";
import { audit } from "./audit.ts";
import type { Config } from "./config.ts";
import { type Db, transaction } from "./db.ts";

/*
 * Signing keys. The private half is a file only this server reads (0600),
 * never a database column and never part of any build. The public halves
 * are published: in the database, at GET /api/v1/keys, and in
 * trusted-keys.json, which compose embeds in every customer build.
 * Rotating makes a new key active; old keys stay trusted, so licences
 * already issued keep verifying.
 */

type KeyRow = { kid: string; public_key: string; created_at: string; active: number };

function newKid() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `k${day}-${Math.random().toString(36).slice(2, 6)}`;
}

function writeAtomic(file: string, text: string, mode?: number) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, text, mode ? { mode } : undefined);
  renameSync(temp, file);
}

export function trustedKeys(db: Db): TrustedKeys {
  const rows = db.prepare("SELECT kid, public_key, created_at FROM signing_keys ORDER BY created_at").all() as KeyRow[];
  return { keys: rows.map((r) => ({ kid: r.kid, publicKey: r.public_key, createdAt: r.created_at })) };
}

/** Publishes every trusted public key where compose reads them. */
export function publishTrustedKeys(db: Db, config: Config) {
  writeAtomic(config.trustedKeysFile, `${JSON.stringify(trustedKeys(db), null, 2)}\n`);
}

export function createKey(db: Db, config: Config, actor: ControlUser | null): string {
  const key = generateSigningKey(newKid());
  mkdirSync(config.keyDir, { recursive: true, mode: 0o700 });
  writeAtomic(join(config.keyDir, `${key.kid}.pem`), key.privateKey, 0o600);
  transaction(db, () => {
    db.prepare("UPDATE signing_keys SET active = 0").run();
    db.prepare("INSERT INTO signing_keys (kid, public_key, created_at, active) VALUES (?, ?, ?, 1)").run(
      key.kid,
      key.publicKey,
      new Date().toISOString(),
    );
    audit(db, actor, "key.created", { type: "key", id: key.kid }, `Signing key ${key.kid} created and made active`);
  });
  publishTrustedKeys(db, config);
  return key.kid;
}

/** The key new licences are signed with, creating the first one on a fresh install. */
export function activeKey(db: Db, config: Config): { kid: string; privateKey: string } {
  let row = db.prepare("SELECT * FROM signing_keys WHERE active = 1").get() as KeyRow | undefined;
  if (!row) {
    createKey(db, config, null);
    row = db.prepare("SELECT * FROM signing_keys WHERE active = 1").get() as KeyRow;
  }
  const file = join(config.keyDir, `${row.kid}.pem`);
  if (!existsSync(file)) {
    throw new Error(`The private key for ${row.kid} is missing (${file}). Restore it, or rotate to a new key.`);
  }
  return { kid: row.kid, privateKey: readFileSync(file, "utf8") };
}

export function ensureKeyFilesPrivate(config: Config) {
  if (existsSync(config.keyDir)) chmodSync(config.keyDir, 0o700);
}

export function listKeys(db: Db): SigningKey[] {
  const rows = db
    .prepare(
      `SELECT k.*, (SELECT count(*) FROM licences l WHERE l.kid = k.kid) AS licences
       FROM signing_keys k ORDER BY k.created_at DESC`,
    )
    .all() as (KeyRow & { licences: number })[];
  return rows.map((r) => ({
    kid: r.kid,
    fingerprint: keyFingerprint(r.public_key),
    publicKey: r.public_key,
    createdAt: r.created_at,
    active: r.active === 1,
    licences: Number(r.licences),
  }));
}
