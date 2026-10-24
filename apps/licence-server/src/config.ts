import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Everything the server reads from its environment. The defaults are for a
 * developer machine: the API answers on 127.0.0.1 only, and its data and
 * signing keys live in apps/licence-server/.data (git-ignored).
 */

const appDir = fileURLToPath(new URL("..", import.meta.url));

export type Config = {
  port: number;
  host: string;
  /** the SQLite database and, unless keyDir says otherwise, the private keys */
  dataDir: string;
  /** private signing keys, one <kid>.pem each (0600). Production: a secret store, never the database. */
  keyDir: string;
  /** the repository: packages/*\/his.product.json is the catalog, customers/<id> the customers' own code */
  repoRoot: string;
  /** where the trusted public keys are published for compose (packages/licence/trusted-keys.json) */
  trustedKeysFile: string;
  sessionHours: number;
  owner: { email: string; password: string | null };
  /** where release bundles are written (scripts/release.mjs --out) */
  releasesDir: string;
  /**
   * The address online installations send their heartbeat to, written into
   * their bundle. Default: this server as a container on the same machine sees it.
   */
  publicUrl: string;
};

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const repoRoot = resolve(env.HIS_REPO_ROOT ?? join(appDir, "../.."));
  if (!existsSync(join(repoRoot, "scripts/compose.mjs"))) {
    throw new Error(`${repoRoot} is not the HIS repository (scripts/compose.mjs is missing). Set HIS_REPO_ROOT.`);
  }
  const dataDir = resolve(env.CONTROL_DATA_DIR ?? join(appDir, ".data"));
  return {
    port: Number(env.CONTROL_API_PORT ?? 4300),
    host: env.CONTROL_API_HOST ?? "127.0.0.1",
    dataDir,
    keyDir: resolve(env.CONTROL_KEY_DIR ?? join(dataDir, "keys")),
    repoRoot,
    trustedKeysFile: resolve(env.CONTROL_TRUSTED_KEYS_FILE ?? join(repoRoot, "packages/licence/trusted-keys.json")),
    sessionHours: Number(env.CONTROL_SESSION_HOURS ?? 12),
    releasesDir: resolve(env.CONTROL_RELEASES_DIR ?? join(dataDir, "releases")),
    publicUrl: (env.CONTROL_PUBLIC_URL ?? `http://host.docker.internal:${env.CONTROL_API_PORT ?? 4300}`).replace(/\/+$/, ""),
    owner: {
      email: (env.CONTROL_OWNER_EMAIL ?? "owner@his.local").toLowerCase(),
      password: env.CONTROL_OWNER_PASSWORD ?? null,
    },
  };
}
