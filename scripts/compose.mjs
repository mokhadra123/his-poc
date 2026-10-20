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
 *
 * Inputs
 *   customers/<id>/customer.json          products bought, features, the customer's own extensions
 *   customers/<id>/package.json           present when the customer has code of its own
 *   packages/<product>/his.product.json   each product's routes and nav items
 *   packages/slots/outlets.json           the outlets core pages offer
 *
 * Outputs (all generated, all git-ignored)
 *   apps/showcase/app/(app)/(composed)/<route>/page.tsx   thin route shells
 *   apps/showcase/lib/products.generated.ts               nav + customer, for the sidebar
 *   apps/showcase/lib/slots.generated.ts                  what is plugged into each outlet
 *   apps/showcase/app/products.generated.css              @source for Tailwind
 *   apps/showcase/products.generated.json                 what was composed (next.config + verify)
 *
 * Anything not composed — a product the customer did not buy, another
 * customer's code — is never imported by these files, and next.config.ts
 * aliases it to lib/not-purchased.ts, so a stray import fails the build.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
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

// every package that ships a his.product.json is a sellable product
const available = new Map();
for (const dir of readdirSync(join(root, "packages"))) {
  const manifest = join(root, "packages", dir, "his.product.json");
  if (existsSync(manifest)) {
    available.set(read(manifest).id, { kind: "product", slots: {}, ...read(manifest), dir: join(root, "packages", dir) });
  }
}

const wanted = customer.products === "*" ? [...available.keys()] : customer.products;
const unknown = wanted.filter((id) => !available.has(id));
if (unknown.length) {
  fail(
    `customer "${customerId}" lists unknown products: ${unknown.map((id) => JSON.stringify(id)).join(", ")}\n` +
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
const summary =
  `"${customerId}" (${customer.name.en}): ` +
  `in = [${wanted.join(", ") || "—"}], out = [${off.join(", ") || "—"}]${ownLine}, ` +
  `theme palette = ${features.themePaletteCustomization ? "changeable" : "default only"}`;

if (checkOnly) {
  console.log(`checked ${summary} — nothing written`);
  process.exit(0);
}

const HEADER = `generated by scripts/compose.mjs for customer "${customerId}" — do not edit`;

// 1. route shells — the old ones go first, so a removed product loses its routes
const routesDir = join(appRoutes, "(composed)");
rmSync(routesDir, { recursive: true, force: true });
rmSync(join(appRoutes, "(products)"), { recursive: true, force: true }); // the folder's old name
// next dev's route types still name the old routes, and next build type-checks
// them too (tsconfig includes .next/dev/types); next dev writes them again
rmSync(join(app, ".next/dev/types"), { recursive: true, force: true });

for (const u of units) {
  for (const r of u.routes) {
    const dir = join(routesDir, r.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "page.tsx"),
      `// ${HEADER}
import { ${r.export} } from "${u.package}/pages";
import { Page, PageTopbar } from "@/components/page-parts";
import { getDict, getLang } from "@/lib/i18n";

const crumb = ${JSON.stringify(u.name)};
const title = ${JSON.stringify(r.title)};

export default async function Route() {
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

export const CUSTOMER: ComposedCustomer = ${JSON.stringify({ id: customer.id, name: customer.name, features })};
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
    { customer: customer.id, features, enabled: units.map(record), excluded: excluded.map(record) },
    null,
    2,
  ) + "\n",
);

console.log(`composed ${summary}`);
