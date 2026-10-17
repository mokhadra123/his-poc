import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// written by scripts/compose.mjs: the products this customer has
type Composed = { customer: string; enabled: { package: string }[]; excluded: { package: string }[] };
const composed: Composed = JSON.parse(readFileSync(path.join(__dirname, "products.generated.json"), "utf8"));

// A product the customer did not buy resolves to lib/not-purchased.ts, so any
// import of it — from app code or from another package — fails the build
// instead of quietly bundling it (transpilePackages alone does not stop that).
const NOT_PURCHASED = "./lib/not-purchased.ts";
const notPurchased = Object.fromEntries(
  composed.excluded.flatMap((p) => [
    [p.package, NOT_PURCHASED],
    [`${p.package}/*`, NOT_PURCHASED],
  ]),
);

const nextConfig: NextConfig = {
  // the deployable unit: only the files the build actually imports
  output: "standalone",
  // TypeScript-source packages Next compiles like app code — the design system
  // plus the composed products; a product the customer lacks is not listed
  transpilePackages: ["@his/ui", ...composed.enabled.map((p) => p.package)],
  turbopack: { root: path.join(__dirname, "../.."), resolveAlias: notPurchased },
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
