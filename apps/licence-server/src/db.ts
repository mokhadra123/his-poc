import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/*
 * SQLite for the POC: one file, no server to install. The schema is written
 * so it moves to Postgres (the monolith's control app) table for table.
 * Times are ISO strings in UTC; days are YYYY-MM-DD.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'issuer', 'viewer')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  disabled_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  package TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  routes TEXT NOT NULL,
  slots TEXT NOT NULL,
  retired INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  country TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS installations (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers (id),
  label TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('production', 'test')),
  connectivity TEXT NOT NULL CHECK (connectivity IN ('online', 'offline')),
  created_at TEXT NOT NULL,
  retired_at TEXT
);
CREATE INDEX IF NOT EXISTS installations_customer ON installations (customer_id);

CREATE TABLE IF NOT EXISTS signing_keys (
  kid TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS licences (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES installations (id),
  customer_id TEXT NOT NULL REFERENCES customers (id),
  kid TEXT NOT NULL REFERENCES signing_keys (kid),
  payload TEXT NOT NULL,
  signature TEXT NOT NULL,
  products TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_on TEXT NOT NULL,
  warn_days INTEGER NOT NULL,
  grace_days INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'superseded', 'revoked')),
  supersedes TEXT REFERENCES licences (id),
  superseded_by TEXT REFERENCES licences (id),
  revoked_at TEXT,
  revoke_reason TEXT,
  issued_by INTEGER NOT NULL REFERENCES users (id),
  note TEXT
);
CREATE INDEX IF NOT EXISTS licences_installation ON licences (installation_id, status);
-- an installation runs on one licence at a time
CREATE UNIQUE INDEX IF NOT EXISTS licences_one_active ON licences (installation_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS heartbeats (
  id INTEGER PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES installations (id),
  licence_id TEXT,
  instance_id TEXT NOT NULL,
  at TEXT NOT NULL,
  version TEXT,
  state TEXT,
  address TEXT
);
CREATE INDEX IF NOT EXISTS heartbeats_installation ON heartbeats (installation_id, at);

-- a build of one installation's HIS from its licence (scripts/release.mjs)
CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES installations (id),
  customer_id TEXT NOT NULL REFERENCES customers (id),
  licence_id TEXT NOT NULL REFERENCES licences (id),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  step TEXT,
  pid INTEGER,
  version TEXT,
  image TEXT,
  image_id TEXT,
  bundle_file TEXT,
  bundle_sha TEXT,
  bytes INTEGER,
  error TEXT,
  requested_by INTEGER NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS releases_installation ON releases (installation_id, created_at);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  user_id INTEGER REFERENCES users (id),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_at ON audit (at);
`;

export type Db = DatabaseSync;

/** ":memory:" for tests */
export function openDb(dataDir: string | ":memory:"): Db {
  let file = ":memory:";
  if (dataDir !== ":memory:") {
    mkdirSync(dataDir, { recursive: true });
    file = join(dataDir, "control.sqlite");
  }
  const db = new DatabaseSync(file);
  // the customer list and every licence: readable by this user only
  if (file !== ":memory:") chmodSync(file, 0o600);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/* Columns added after a database was first made. Each runs once. */
function migrate(db: Db) {
  const columns = (table: string) =>
    new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
  // the customer's themes (JSON: { default, allowed, brand }); null = still as customer.json says
  if (!columns("customers").has("theme")) db.exec("ALTER TABLE customers ADD COLUMN theme TEXT");
  // the build's process, to tell a running build from one that stopped
  if (!columns("releases").has("pid")) db.exec("ALTER TABLE releases ADD COLUMN pid INTEGER");
}

/** Runs `work` in one transaction: all of it or none of it. */
export function transaction<T>(db: Db, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getMeta(db: Db, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(db: Db, key: string, value: string) {
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key, value);
}
