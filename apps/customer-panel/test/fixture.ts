/*
 * A throwaway repository in the OS temp folder, laid out like the real one,
 * so tests can write customers and run compose without touching real data.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** the real repository, read-only: tests only copy scripts/compose.mjs from it */
export const REAL_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const product = (id: string, route: string) => ({
  id,
  package: `@his/${id}`,
  name: { en: id, ar: id },
  nav: [{ href: `/${route}`, icon: "receipt", section: "revenue", label: { en: id, ar: id } }],
  routes: [{ path: route, export: "Page", title: { en: id, ar: id } }],
});

export type Fixture = {
  root: string;
  write(path: string, content: unknown): void;
  read(path: string): string;
  cleanup(): void;
};

export function makeRepo({ realCompose = false }: { realCompose?: boolean } = {}): Fixture {
  const root = mkdtempSync(join(tmpdir(), "his-panel-test-"));
  const write = (path: string, content: unknown) => {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`);
  };
  write("packages/billing/his.product.json", product("billing", "billing/invoices"));
  write("packages/pharmacy/his.product.json", product("pharmacy", "pharmacy/stock"));
  write("packages/ui/package.json", { name: "@his/ui" });
  write("packages/slots/outlets.json", { "visit.side-panel": { page: "/visit", where: "side panel" } });
  write("apps/showcase/package.json", { name: "@his/showcase" });
  mkdirSync(join(root, "apps/showcase/app/(app)/dashboard"), { recursive: true });
  mkdirSync(join(root, "apps/showcase/lib"), { recursive: true });
  write("customers/plain/customer.json", { id: "plain", name: { en: "Plain", ar: "عادي" }, products: ["billing"] });
  if (realCompose) {
    mkdirSync(join(root, "scripts"), { recursive: true });
    copyFileSync(join(REAL_ROOT, "scripts/compose.mjs"), join(root, "scripts/compose.mjs"));
  }
  return {
    root,
    write,
    read: (path) => readFileSync(join(root, path), "utf8"),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** A port nothing listens on right now. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** Poll until `check` holds, or fail after `ms`. */
export async function eventually<T>(check: () => Promise<T | undefined> | T | undefined, ms = 15_000): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`condition not met within ${ms} ms`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
