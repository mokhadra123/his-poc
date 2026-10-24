import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createUser } from "./auth.ts";
import type { Config } from "./config.ts";
import type { Db } from "./db.ts";
import { activeKey, ensureKeyFilesPrivate, publishTrustedKeys } from "./keys.ts";
import { settleReleases } from "./releases.ts";
import { importCustomers, syncCatalog } from "./repo.ts";

/*
 * What a start makes sure of: an owner who can sign in, a signing key, the
 * published public keys, the catalog, and (first start only) the customers
 * the repository already has. Returns what to tell the person starting it.
 */
export function prepare(db: Db, config: Config): string[] {
  const notes: string[] = [];
  const users = db.prepare("SELECT count(*) AS n FROM users").get() as { n: number };
  if (Number(users.n) === 0) {
    const password = config.owner.password ?? randomBytes(9).toString("base64url");
    createUser(db, { email: config.owner.email, name: "Control owner", role: "owner", password });
    if (config.owner.password) {
      notes.push(`Created the owner ${config.owner.email} with CONTROL_OWNER_PASSWORD`);
    } else {
      // like a first-run admin password: readable by this user only, in the git-ignored data folder
      const file = join(config.dataDir, "initial-owner.txt");
      mkdirSync(config.dataDir, { recursive: true });
      writeFileSync(file, `${config.owner.email}\n${password}\n`, { mode: 0o600 });
      notes.push(`Created the owner ${config.owner.email}; the first sign-in password is in ${file}`);
    }
  }
  ensureKeyFilesPrivate(config);
  const key = activeKey(db, config);
  publishTrustedKeys(db, config);
  notes.push(`Signing with ${key.kid}; trusted public keys published to ${config.trustedKeysFile}`);
  const catalog = syncCatalog(db, config, null);
  notes.push(`Catalog: ${catalog.products} product(s)${catalog.problems.length ? `, problems: ${catalog.problems.join("; ")}` : ""}`);
  settleReleases(db, config);
  const imported = importCustomers(db, config);
  if (imported) notes.push(`Imported ${imported} customer(s) from customers/`);
  return notes;
}
