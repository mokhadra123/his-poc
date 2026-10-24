#!/usr/bin/env node
/*
 * Complete the standalone image after `next build`.
 *
 * `output: "standalone"` puts the server and the files it imports in
 * .next/standalone, but not what the browser downloads: .next/static (the CSS
 * and JS chunks) and public. Without them `npm run start` serves every page
 * with 404s for its stylesheet and scripts, so nothing is styled and nothing
 * responds. Next leaves this copy to the build (see its `output` docs); this
 * script is that copy, run as the showcase's postbuild.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("../apps/showcase/", import.meta.url));
const server = join(app, ".next/standalone/apps/showcase");

if (!existsSync(join(server, "server.js"))) {
  console.error("standalone-assets: no standalone server; run next build first.");
  process.exit(1);
}

for (const [from, to] of [
  [join(app, ".next/static"), join(server, ".next/static")],
  [join(app, "public"), join(server, "public")],
]) {
  if (!existsSync(from)) continue;
  // a stale copy from an earlier build would keep chunks that no longer exist
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`standalone-assets: ${from.slice(app.length)} → ${to.slice(app.length)}`);
}
