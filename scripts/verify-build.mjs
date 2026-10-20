#!/usr/bin/env node
/*
 * Prove a composed build only contains the products its customer has.
 * Run after `npm run build` (which composes first):
 *
 *   HIS_CUSTOMER=al-amal npm run build && npm run verify:build
 *
 * Every composed unit — a product, or a customer's own code — carries marker
 * strings (`*_MARK = "..."`) in its server and client modules. For each unit
 * this checks:
 *   1. source   no hand-written app file imports it
 *   2. bundles  its markers are in .next/server, .next/static and the
 *               standalone image when enabled, and in none of them when not
 *   3. runtime  the standalone server answers its routes with 200 when
 *               enabled and 404 when not, the sidebar links to them only when
 *               enabled, and the outlets it plugs into show its content only
 *               when enabled
 *   4. palette  a saved theme cookie, the theme picker and ?theme= links work
 *               only when the customer may change its palette
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// const root = new URL("..", import.meta.url).pathname;
const root = fileURLToPath(new URL("../", import.meta.url));
const app = join(root, "apps/showcase");
const next = join(app, ".next");
const standalone = join(next, "standalone");
const PORT = Number(process.env.VERIFY_PORT || 3300);

const composed = JSON.parse(readFileSync(join(app, "products.generated.json"), "utf8"));
const outlets = JSON.parse(readFileSync(join(root, "packages/slots/outlets.json"), "utf8"));
const products = [
  ...composed.enabled.map((p) => ({ ...p, enabled: true })),
  ...composed.excluded.map((p) => ({ ...p, enabled: false })),
];
if (!existsSync(join(standalone, "apps/showcase/server.js"))) {
  console.error("No standalone build. Run `npm run build` first.");
  process.exit(1);
}

let failed = 0;
const check = (ok, line) => {
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${line}`);
};

function* walk(dir, skip = () => false) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (skip(full)) continue;
    if (entry.isDirectory()) yield* walk(full, skip);
    else if (entry.isFile()) yield full;
  }
}
const TEXT = /\.(js|mjs|cjs|json|html|rsc|css|map|txt|tsx?)$/;
const filesWith = (dir, needle) => {
  const hits = [];
  for (const f of walk(dir)) if (TEXT.test(f) && readFileSync(f, "utf8").includes(needle)) hits.push(f);
  return hits;
};
const sizeOf = (dir) => {
  let total = 0;
  for (const f of walk(dir)) total += statSync(f).size;
  return total;
};
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

// the marker strings each unit declares
for (const p of products) {
  const dir = join(root, p.dir, "src");
  p.markers = [];
  for (const f of walk(dir)) {
    for (const [, name, value] of readFileSync(f, "utf8").matchAll(/(\w+_MARK) = "([^"]+)"/g)) {
      // a SLOT marker sits in what the unit plugs into an outlet, so it shows on that outlet's page
      const kind = name.includes("CLIENT") ? "client" : name.includes("SLOT") ? "slot" : "server";
      p.markers.push({ kind, value });
    }
  }
}

console.log(`\nverify build for customer "${composed.customer}"`);

// 1. source: only generated files may import a product
console.log("\n1. source");
// [\\/]: walk() yields the platform's separator
const generated = /[\\/]\(composed\)[\\/]|\.generated\./;
const appFiles = [...walk(app, (f) => /[\\/](node_modules|\.next)$/.test(f))].filter(
  (f) => /\.(tsx?|css)$/.test(f) && !generated.test(f),
);
for (const p of products) {
  const leaks = appFiles.filter((f) => readFileSync(f, "utf8").includes(`"${p.package}`));
  check(leaks.length === 0, `${p.package} imported by hand-written app code: ${leaks.map((f) => relative(root, f)).join(", ") || "nowhere"}`);
}

// 2. bundles
console.log("\n2. bundles");
const places = [
  ["server", join(next, "server")],
  ["static", join(next, "static")],
  ["standalone", standalone],
];
for (const p of products) {
  for (const m of p.markers) {
    for (const [place, dir] of places) {
      // client code is in the browser chunks; a server-only module never is
      if (place === "static" && m.kind !== "client") continue;
      const n = filesWith(dir, m.value).length;
      check(p.enabled ? n > 0 : n === 0, `${p.id.padEnd(18)} ${m.kind} marker in ${place.padEnd(10)} ${n} file(s)`);
    }
  }
  const copied = existsSync(join(standalone, "node_modules", p.package)) || existsSync(join(standalone, p.dir));
  check(!(copied && !p.enabled), `${p.id.padEnd(18)} package copied into standalone: ${copied ? "yes" : "no"}`);
}

// 3. runtime: the standalone image is what ships, so run that
console.log("\n3. runtime (standalone server)");
const serverDir = join(standalone, "apps/showcase");
// The build must ship the browser's files with the server (the showcase's
// postbuild). This used to copy them itself, which hid that `npm run start`
// served every page without its CSS and JS.
check(existsSync(join(serverDir, ".next/static")), "standalone image holds .next/static (CSS, JS)");

const server = spawn(process.execPath, ["server.js"], {
  cwd: serverDir,
  env: { ...process.env, PORT: String(PORT), HOSTNAME: "127.0.0.1" },
  stdio: "ignore",
});
const base = `http://127.0.0.1:${PORT}`;
try {
  for (let i = 0; ; i++) {
    try {
      await fetch(base, { redirect: "manual" });
      break;
    } catch {
      if (i > 100) throw new Error(`standalone server did not start on ${PORT}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const dashboard = await (await fetch(`${base}/dashboard`)).text();
  const assets = [...dashboard.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+\.(?:css|js))"/g)].map((m) => m[1]);
  const missing = [];
  for (const asset of assets) if ((await fetch(`${base}${asset}`)).status !== 200) missing.push(asset);
  check(assets.length > 0 && missing.length === 0, `GET /dashboard's ${assets.length} stylesheets and scripts → ${missing.length ? `${missing.length} missing, e.g. ${missing[0]}` : "all 200"}`);
  for (const p of products) {
    for (const route of p.routes) {
      const res = await fetch(`${base}/${route}`, { redirect: "manual" });
      const body = await res.text();
      const want = p.enabled ? 200 : 404;
      const marked = p.markers.filter((m) => m.kind !== "slot").every((m) => body.includes(m.value));
      check(res.status === want && (!p.enabled || marked), `${p.id.padEnd(18)} GET /${route} → ${res.status}${p.enabled ? (marked ? ", page rendered" : ", markers missing") : ""}`);
      const linked = dashboard.includes(`href="/${route}"`);
      check(linked === p.enabled, `${p.id.padEnd(18)} sidebar links /${route}: ${linked ? "yes" : "no"}`);
    }
    for (const outlet of p.slots) {
      const page = outlets[outlet].page;
      const body = await (await fetch(`${base}${page}`)).text();
      const shown =
        body.includes(`data-slot-from="${p.package}"`) &&
        p.markers.filter((m) => m.kind === "slot").every((m) => body.includes(m.value));
      check(shown === p.enabled, `${p.id.padEnd(18)} outlet ${outlet} on ${page} shows it: ${shown ? "yes" : "no"}`);
    }
  }

  // 4. palette: missing in an older composition counts as "may not change"
  const changeable = composed.features?.themePaletteCustomization === true;
  console.log(`\n4. palette (${changeable ? "customer may change it" : "default only"})`);
  const saved = await (await fetch(`${base}/dashboard`, { headers: { cookie: "his-theme=pine" } })).text();
  const html = saved.match(/<html[^>]*>/)?.[0] ?? "";
  const theme = html.match(/\sdata-theme="([^"]*)"/)?.[1];
  check((theme === "pine") === changeable, `saved theme cookie "pine" → data-theme="${theme}"`);
  const locked = html.includes(' data-palette="locked"');
  check(locked === !changeable, `<html data-palette="locked">: ${locked ? "yes" : "no"}`);
  const picker = saved.includes('role="group" aria-label="Theme"');
  check(picker === changeable, `theme picker in the review bar: ${picker ? "yes" : "no"}`);
  const link = await fetch(`${base}/dashboard?theme=ink`, { redirect: "manual" });
  const cookie = (link.headers.get("set-cookie") ?? "").includes("his-theme=ink");
  check(cookie === changeable, `?theme=ink → ${link.status}, sets the theme cookie: ${cookie ? "yes" : "no"}`);
} finally {
  server.kill();
}

console.log("\nsizes");
console.log(`  standalone image   ${mb(sizeOf(standalone))}`);
console.log(`  .next/static       ${mb(sizeOf(join(next, "static")))}`);
console.log(`  .next/server       ${mb(sizeOf(join(next, "server")))}`);

console.log(failed ? `\n${failed} check(s) failed.` : `\nall checks passed.`);
process.exit(failed ? 1 : 0);
