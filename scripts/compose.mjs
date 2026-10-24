#!/usr/bin/env node
/*
 * Compose a customer's build: the products the customer bought, plus the
 * customer's own code (its pages, and what it plugs into the core's outlets),
 * become part of the app. Run before `next build` (and `next dev`).
 *
 *   HIS_CUSTOMER=al-amal node scripts/compose.mjs
 *
 *   --check                 validate everything, write nothing
 *   --customer-file <path>  read the customer from <path> instead of
 *                           customers/<id>/customer.json (a draft, e.g. from
 *                           the customer panel, checked before it is saved)
 *   --licence <path>        compose from a signed licence (or HIS_LICENCE=<path>):
 *                           its products replace customer.json's, and the build
 *                           checks the installed licence at runtime
 *   --force                 compose another customer even while the showcase's
 *                           next dev runs (it must be restarted afterwards)
 *
 * Inputs
 *   customers/<id>/customer.json          products bought, its themes, features, the customer's own extensions
 *   customers/<id>/package.json           present when the customer has code of its own
 *   packages/<product>/his.product.json   each product's routes and nav items
 *   packages/slots/outlets.json           the outlets core pages offer
 *   <licence file>                        optional: what the customer licensed (packages/licence)
 *   packages/licence/trusted-keys.json    the public keys a licence is checked with
 *                                         (written by apps/licence-server; HIS_LICENCE_KEYS overrides)
 *
 * Outputs (all generated, all git-ignored)
 *   apps/showcase/app/(app)/(composed)/<route>/page.tsx   thin route shells
 *   apps/showcase/lib/products.generated.ts               nav + customer, for the sidebar
 *   apps/showcase/lib/slots.generated.ts                  what is plugged into each outlet
 *   apps/showcase/lib/licence.generated.ts                whether the build checks a licence, with which keys
 *   apps/showcase/app/products.generated.css              @source for Tailwind
 *   apps/showcase/products.generated.json                 what was composed (next.config + verify)
 *   apps/showcase/.licence/license.json                   the licence, installed (only with --licence)
 *
 * Anything not composed — a product the customer did not buy, another
 * customer's code — is never imported by these files, and next.config.ts
 * aliases it to lib/not-purchased.ts, so a stray import fails the build.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// const root = new URL("..", import.meta.url).pathname;
const root = fileURLToPath(new URL("../", import.meta.url));
const app = join(root, "apps/showcase");
const customersDir = join(root, "customers");
const customerId = process.env.HIS_CUSTOMER || "all";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const fail = (message) => {
  console.error(`compose: ${message}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const customerFile = args.includes("--customer-file") ? args[args.indexOf("--customer-file") + 1] : undefined;
if (args.includes("--customer-file") && !customerFile) fail("--customer-file needs a path");
if (customerFile && !existsSync(customerFile)) fail(`customer file not found: ${customerFile}`);
const licenceFile = args.includes("--licence") ? args[args.indexOf("--licence") + 1] : process.env.HIS_LICENCE || undefined;
if (args.includes("--licence") && !licenceFile) fail("--licence needs a path");
if (licenceFile && !existsSync(licenceFile)) fail(`licence file not found: ${licenceFile}`);

const known = readdirSync(customersDir).filter((d) => existsSync(join(customersDir, d, "customer.json")));
if (!known.includes(customerId)) fail(`unknown customer "${customerId}". Known: ${known.join(", ")}`);
const customer = read(customerFile ?? join(customersDir, customerId, "customer.json"));
if (customer.id !== customerId) fail(`customer "${customerId}" has "id": "${customer.id}" — they must match`);
if (typeof customer.name?.en !== "string" || typeof customer.name?.ar !== "string") {
  fail(`customer "${customerId}" needs a name in both languages: "name": { "en": …, "ar": … }`);
}
if (customer.products !== "*" && !Array.isArray(customer.products)) {
  fail(`customer "${customerId}": "products" must be "*" or a list of product ids`);
}

// what the customer may change in the app; anything not set is off
const FEATURES = ["themePaletteCustomization"];
const features = Object.fromEntries(FEATURES.map((f) => [f, false]));
if (customer.features !== undefined) {
  if (typeof customer.features !== "object" || customer.features === null || Array.isArray(customer.features)) {
    fail(`customer "${customerId}": "features" must be an object`);
  }
  for (const [name, value] of Object.entries(customer.features)) {
    if (!FEATURES.includes(name)) fail(`customer "${customerId}" sets unknown feature "${name}". Known: ${FEATURES.join(", ")}`);
    if (typeof value !== "boolean") fail(`customer "${customerId}": feature "${name}" must be true or false`);
    features[name] = value;
  }
}

// The customer's themes (set in the control app): "theme": { "default", "allowed", "brand" }.
// One theme is a fixed look; several let each user switch. A customer.json
// from before keeps its meaning: themePaletteCustomization true = every
// theme, false/missing = the default (slate) only.
// The names must match @his/ui's THEMES; the generated file is typed with
// ThemePolicy, so the showcase typecheck catches a drift.
const THEMES = ["slate", "ink", "pine", "graphite", "custom", "original"];
const HEX = /^#[0-9a-f]{6}$/i;
let theme;
if (customer.theme === undefined) {
  theme = { default: "slate", allowed: features.themePaletteCustomization ? THEMES : ["slate"], brand: null };
} else {
  const t = customer.theme;
  const where = `customer "${customerId}": "theme"`;
  if (typeof t !== "object" || t === null || Array.isArray(t)) fail(`${where} must be an object`);
  if (!Array.isArray(t.allowed) || t.allowed.length === 0) fail(`${where}.allowed must list at least one theme`);
  const unknownThemes = t.allowed.filter((name) => !THEMES.includes(name));
  if (unknownThemes.length) fail(`${where}.allowed has unknown themes: ${unknownThemes.join(", ")}. Themes: ${THEMES.join(", ")}`);
  if (new Set(t.allowed).size !== t.allowed.length) fail(`${where}.allowed lists a theme twice`);
  const fallback = t.default ?? t.allowed[0];
  if (!t.allowed.includes(fallback)) fail(`${where}.default "${fallback}" is not one of the allowed themes`);
  if (t.brand != null && (typeof t.brand !== "string" || !HEX.test(t.brand))) fail(`${where}.brand must be a colour like "#1f6f8b"`);
  // keep @his/ui's order, so the theme picker reads the same everywhere
  theme = { default: fallback, allowed: THEMES.filter((name) => t.allowed.includes(name)), brand: t.brand ? t.brand.toLowerCase() : null };
}
// what the customer panel and verify-build still read: may its users change anything?
features.themePaletteCustomization = theme.allowed.length > 1 || (theme.allowed.includes("custom") && theme.brand === null);

// A licence, when given, is the one source of truth for what was bought: it
// is checked with the trusted public keys (never with a key lying next to it),
// and those keys are embedded in the build so it can check renewals itself.
let licence = null;
if (licenceFile) {
  const keysFile = resolve(process.env.HIS_LICENCE_KEYS || join(root, "packages/licence/trusted-keys.json"));
  if (!existsSync(keysFile)) {
    fail(`no trusted keys: start apps/licence-server once, or set HIS_LICENCE_KEYS (looked for ${keysFile})`);
  }
  let keys;
  try {
    keys = read(keysFile);
  } catch (error) {
    fail(`trusted keys ${keysFile} are not valid JSON: ${error.message}`);
  }
  const keyOk = (k) => typeof k?.kid === "string" && typeof k?.publicKey === "string" && typeof k?.createdAt === "string";
  if (!Array.isArray(keys?.keys) || !keys.keys.every(keyOk)) {
    fail(`trusted keys ${keysFile} must look like { "keys": [{ "kid", "publicKey", "createdAt" }] }`);
  }
  if (!keys.keys.length) fail(`no trusted keys: ${keysFile} lists none`);
  const text = readFileSync(licenceFile, "utf8");
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    fail(`licence ${licenceFile} is not valid JSON`);
  }
  // imported only here: the customer panel's tests run this script in a copy
  // of the repository without node_modules, and never pass a licence
  const { verifyLicence } = await import("@his/licence/server");
  const { evaluateLicence } = await import("@his/licence");
  const verified = verifyLicence(file, keys);
  if (!verified.ok) fail(`licence ${licenceFile}: ${verified.reason}`);
  const { payload } = verified;
  if (payload.customerId !== customerId) {
    fail(`licence ${licenceFile} is for customer "${payload.customerId}", not "${customerId}"`);
  }
  licence = {
    text,
    payload,
    trustedKeys: { keys: keys.keys.map(({ kid, publicKey, createdAt }) => ({ kid, publicKey, createdAt })) },
    state: evaluateLicence(payload).state,
  };
}

// every package that ships a his.product.json is a sellable product
const available = new Map();
for (const dir of readdirSync(join(root, "packages"))) {
  const manifest = join(root, "packages", dir, "his.product.json");
  if (existsSync(manifest)) {
    available.set(read(manifest).id, { kind: "product", slots: {}, ...read(manifest), dir: join(root, "packages", dir) });
  }
}

const wanted = licence
  ? licence.payload.products
  : customer.products === "*"
    ? [...available.keys()]
    : customer.products;
const unknown = wanted.filter((id) => !available.has(id));
if (unknown.length) {
  fail(
    `${licence ? `licence "${licence.payload.licenceId}"` : `customer "${customerId}"`} lists unknown products: ` +
      `${unknown.map((id) => JSON.stringify(id)).join(", ")}\n` +
      `  Products: ${[...available.keys()].join(", ")}`,
  );
}

// a customer folder with a package.json has code of its own
const ownCode = (id) => {
  const dir = join(customersDir, id);
  if (!existsSync(join(dir, "package.json"))) return null;
  const c = id === customerId ? customer : read(join(dir, "customer.json"));
  const ext = c.extensions ?? {};
  return {
    kind: "customer",
    id: `${id} (own code)`,
    package: read(join(dir, "package.json")).name,
    dir,
    name: c.name,
    nav: ext.nav ?? [],
    routes: ext.routes ?? [],
    slots: ext.slots ?? {},
  };
};

const own = ownCode(customerId);
const units = [...wanted.map((id) => available.get(id)), ...(own ? [own] : [])];
const excluded = [
  ...[...available.values()].filter((p) => !wanted.includes(p.id)),
  ...known.filter((id) => id !== customerId).map(ownCode).filter(Boolean),
];

// a customer can only plug into an outlet a core page actually offers
const outlets = read(join(root, "packages/slots/outlets.json"));
for (const u of units) {
  for (const name of Object.keys(u.slots)) {
    if (!(name in outlets)) {
      fail(
        `${u.package} plugs into outlet "${name}", but no core page offers it.\n` +
          `  Outlets: ${Object.keys(outlets).join(", ") || "none"} (packages/slots/outlets.json)`,
      );
    }
  }
}

// every route is checked before anything is written, so a failed compose
// leaves the last good output in place
const appRoutes = join(app, "app/(app)");
const claimed = new Map();
for (const u of units) {
  for (const r of u.routes) {
    if (claimed.has(r.path)) fail(`/${r.path} is claimed by both ${claimed.get(r.path)} and ${u.package}`);
    if (existsSync(join(appRoutes, r.path))) fail(`/${r.path} from ${u.package} would shadow a core page`);
    claimed.set(r.path, u.package);
  }
}

const off = [...available.keys()].filter((id) => !wanted.includes(id));
const ownLine = own
  ? `, own code = ${own.package} (${own.routes.length} page(s), ${Object.keys(own.slots).length} outlet(s))`
  : "";
const source = licence
  ? `licence "${licence.payload.licenceId}" (installation "${licence.payload.installationId}", ` +
    `last valid day ${licence.payload.expiresOn}, ${licence.state})`
  : "customer.json";
const summary =
  `"${customerId}" (${customer.name.en}): ` +
  `in = [${wanted.join(", ") || "—"}], out = [${off.join(", ") || "—"}] from ${source}${ownLine}, ` +
  `theme = ${theme.allowed.length > 1 ? `${theme.default} (users switch between ${theme.allowed.join(", ")})` : `${theme.default} only`}` +
  `${theme.brand ? `, brand ${theme.brand}` : ""}`;

if (checkOnly) {
  console.log(`checked ${summary} — nothing written`);
  process.exit(0);
}

// A running `next dev` read the composition once, when it started: its
// next.config aliases what was excluded THEN. Changing the composition under
// it ships route shells for products it still treats as not purchased
// ("Can't resolve 'HIS_PRODUCT_NOT_PURCHASED'"). Recomposing the same
// customer with the same products is harmless (a renewed licence).
const devLock = join(app, ".next/dev/lock");
if (existsSync(devLock) && !args.includes("--force")) {
  let server = null;
  try {
    server = JSON.parse(readFileSync(devLock, "utf8"));
    process.kill(server.pid, 0); // throws when the process is gone (a stale lock)
  } catch {
    server = null;
  }
  const previous = existsSync(join(app, "products.generated.json")) ? read(join(app, "products.generated.json")) : null;
  const same =
    previous?.customer === customerId &&
    JSON.stringify(previous.enabled.map((u) => u.id).sort()) === JSON.stringify(units.map((u) => u.id).sort());
  if (server && !same) {
    fail(
      `the showcase is running at ${server.appUrl ?? `port ${server.port}`} (pid ${server.pid}) for customer "${previous?.customer}".\n` +
        `  It read its composition when it started, so composing "${customerId}" under it breaks it. Stop it first,\n` +
        `  compose, then start it again (or pass --force and restart it yourself).`,
    );
  }
}

const HEADER = `generated by scripts/compose.mjs for customer "${customerId}" — do not edit`;

// 1. route shells — the old ones go first, so a removed product loses its routes
const routesDir = join(appRoutes, "(composed)");
rmSync(routesDir, { recursive: true, force: true });
rmSync(join(appRoutes, "(products)"), { recursive: true, force: true }); // the folder's old name
// next dev's and the last next build's route types still name the old routes,
// and tsc checks them (tsconfig includes both); the next dev or build writes them again
rmSync(join(app, ".next/dev/types"), { recursive: true, force: true });
rmSync(join(app, ".next/types"), { recursive: true, force: true });

for (const u of units) {
  for (const r of u.routes) {
    const dir = join(routesDir, r.path);
    mkdirSync(dir, { recursive: true });
    // a product's route answers 404 once the installed licence no longer
    // includes it (lib/licence.ts); the customer's own pages are not licensed
    const guarded = u.kind === "product";
    writeFileSync(
      join(dir, "page.tsx"),
      `// ${HEADER}
import { ${r.export} } from "${u.package}/pages";
import { Page, PageTopbar } from "@/components/page-parts";
import { getDict, getLang } from "@/lib/i18n";${guarded ? `\nimport { requireProduct } from "@/lib/licence";` : ""}

const crumb = ${JSON.stringify(u.name)};
const title = ${JSON.stringify(r.title)};

export default async function Route() {${guarded ? `\n  await requireProduct(${JSON.stringify(u.id)});` : ""}
  const lang = await getLang();
  const t = await getDict();
  return (
    <>
      <PageTopbar crumbs={[crumb[lang]]} current={title[lang]} t={t.shell} />
      <Page>
        <${r.export} lang={lang} />
      </Page>
    </>
  );
}
`,
    );
  }
}

// 2. what the sidebar shows: the products, then the customer's own pages
writeFileSync(
  join(app, "lib/products.generated.ts"),
  `// ${HEADER}
import type { ComposedCustomer, ProductManifest } from "./products";

export const CUSTOMER: ComposedCustomer = ${JSON.stringify({ id: customer.id, name: customer.name, features, theme })};
export const PRODUCTS: ProductManifest[] = ${JSON.stringify(
    units.map((u) => ({ id: u.id, package: u.package, name: u.name, nav: u.nav, routes: u.routes })),
    null,
    2,
  )};
`,
);

// 3. what is plugged into each outlet; SlotRegistry type-checks every
//    component against the outlet's props
const plugs = units.flatMap((u) =>
  Object.entries(u.slots).flatMap(([outlet, exports]) => [].concat(exports).map((name) => ({ outlet, name, u }))),
);
const byOutlet = Object.groupBy(
  plugs.map((p, i) => ({ ...p, local: `s${i}` })),
  (p) => p.outlet,
);
writeFileSync(
  join(app, "lib/slots.generated.ts"),
  `// ${HEADER}
import type { SlotRegistry } from "@his/slots";
${plugs.map((p, i) => `import { ${p.name} as s${i} } from "${p.u.package}/slots";`).join("\n")}

export const SLOTS: SlotRegistry = {${Object.entries(byOutlet)
    .map(
      ([outlet, list]) =>
        `\n  ${JSON.stringify(outlet)}: [${list.map((p) => `{ from: ${JSON.stringify(p.u.package)}, Component: ${p.local} }`).join(", ")}],`,
    )
    .join("")}${plugs.length ? "\n" : ""}};
`,
);

// 4. Tailwind only scans the code that is in
writeFileSync(
  join(app, "app/products.generated.css"),
  `/* ${HEADER} */\n${units.map((u) => `@source "${relative(join(app, "app"), join(u.dir, "src"))}";`).join("\n")}\n`,
);

// 5. the record next.config.ts and verify-build.mjs read
const record = (u) => ({
  id: u.id,
  kind: u.kind,
  package: u.package,
  dir: relative(root, u.dir),
  routes: u.routes.map((r) => r.path),
  slots: Object.keys(u.slots),
});
writeFileSync(
  join(app, "products.generated.json"),
  JSON.stringify(
    { customer: customer.id, features, theme, enabled: units.map(record), excluded: excluded.map(record) },
    null,
    2,
  ) + "\n",
);

// 6. licensing: off for a build composed without a licence (development);
//    on, the build checks the installed licence with the keys embedded here
const licensing = {
  enabled: Boolean(licence),
  trustedKeys: licence ? licence.trustedKeys : { keys: [] },
  builtProducts: units.filter((u) => u.kind === "product").map((u) => u.id),
};
writeFileSync(
  join(app, "lib/licence.generated.ts"),
  `// ${HEADER}
import type { TrustedKeys } from "@his/licence/server";

/**
 * enabled        composed from a licence: the installed licence is checked at runtime (lib/licence.ts)
 * trustedKeys    the public keys it is checked with — part of the build, never read from beside the licence
 * builtProducts  the products composed into this build
 */
export const LICENSING: { enabled: boolean; trustedKeys: TrustedKeys; builtProducts: string[] } = ${JSON.stringify(
    licensing,
    null,
    2,
  )};
`,
);

// 7. the licence goes into the showcase's licence store, as an installation's
//    would; a revocation learned for another licence does not carry over
if (licence) {
  const store = join(app, ".licence");
  mkdirSync(store, { recursive: true });
  const installed = join(store, "license.json");
  const tryRead = (p) => {
    try {
      return read(p);
    } catch {
      return null;
    }
  };
  const previous = existsSync(installed) ? tryRead(installed)?.payload?.licenceId : undefined;
  writeFileSync(installed, licence.text);
  const statePath = join(store, "state.json");
  const state = existsSync(statePath) ? tryRead(statePath) : null;
  if (state?.revokedOn && previous !== licence.payload.licenceId) {
    writeFileSync(statePath, `${JSON.stringify({ ...state, revokedOn: null }, null, 2)}\n`);
  }
}

console.log(`composed ${summary}`);
if (licence) console.log(`installed the licence in ${relative(root, join(app, ".licence/license.json"))}`);
