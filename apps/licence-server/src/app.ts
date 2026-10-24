import express, { type Express, type Request } from "express";
import { z } from "zod";
import { formatLicenceFile } from "@his/licence";
// the theme names only; the module also holds browser code (hence DOM in tsconfig "lib"), never called here
import { THEMES } from "@his/ui/theme";
import { listAudit } from "./audit.ts";
import { login, logout, requireRole, requireSession } from "./auth.ts";
import type { Config } from "./config.ts";
import { createCustomer, getCustomer, listCustomers, setArchived, setCustomerTheme, updateCustomer } from "./customers.ts";
import type { Db } from "./db.ts";
import { heartbeat } from "./heartbeat.ts";
import { errorHandler, parse, send } from "./http.ts";
import { createInstallation, getInstallation, listInstallations, retireInstallation, updateInstallation } from "./installations.ts";
import { createKey, listKeys, trustedKeys } from "./keys.ts";
import { getLicence, issueLicence, listLicences, revokeLicence } from "./licences.ts";
import { overview } from "./overview.ts";
import { getRelease, listReleases, releaseBundle, startRelease } from "./releases.ts";
import { listProducts, syncCatalog } from "./repo.ts";

/* ---------- input ---------- */

// "all" is the developers' everything-build in customers/; the rest are folder names Windows refuses
const RESERVED_IDS = /^(all|con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const customerId = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "1–40 characters: lowercase letters, digits and inner hyphens (al-amal)")
  .refine((id) => !RESERVED_IDS.test(id), "This id is reserved; pick another");
const localized = z.object({
  en: z.string().trim().min(1, "Required").max(120),
  ar: z.string().trim().min(1, "Required").max(120),
});
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const customerFields = {
  name: localized,
  contactName: optionalText(120),
  contactEmail: z.union([z.literal(""), z.email("Not an e-mail address")]).nullish(),
  country: optionalText(60),
  notes: optionalText(2000),
};
const customerInput = z.object({ id: customerId, ...customerFields });
const customerUpdate = z.object(customerFields);
const themeInput = z.object({
  allowed: z.array(z.enum(THEMES)).min(1, "Allow at least one theme"),
  default: z.enum(THEMES),
  brand: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "A colour like #1f6f8b")
    .nullish()
    .transform((v) => v ?? null),
});
const installationInput = z.object({
  label: z.string().trim().min(1, "Required").max(80),
  environment: z.enum(["production", "test"]),
  connectivity: z.enum(["online", "offline"]),
});
const issueInput = z.object({
  installationId: z.string().min(1).max(64),
  products: z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)).max(100),
  // a real calendar day: 2027-02-30 and 2027-13-01 are refused
  expiresOn: z.iso.date("A date that exists: YYYY-MM-DD"),
  warnDays: z.int().min(0).max(180),
  graceDays: z.int().min(0).max(90),
  note: optionalText(500),
});
const revokeInput = z.object({ reason: z.string().trim().min(3, "Say why, in a few words").max(300) });
const loginInput = z.object({ email: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) });
const heartbeatInput = z.object({
  installationId: z.string().min(1).max(64),
  licenceId: z.string().min(1).max(64),
  instanceId: z.string().min(8).max(64),
  version: z.string().max(40).nullish(),
  state: z.string().max(20).nullish(),
});

const query = (req: Request, name: string) => {
  const value = req.query[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

/* ---------- routes ---------- */

export function createApp(db: Db, config: Config): Express {
  const app = express();
  app.disable("x-powered-by");
  // no "trust proxy": nothing in front of this server may name the caller's address
  app.use(express.json({ limit: "64kb" }));
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  /* public: no session */
  app.get("/api/health", (_req, res) => send(res, { status: "ok" }));
  app.post("/api/auth/login", (req, res) => {
    const input = parse(loginInput, req.body);
    send(res, login(db, input.email, input.password, config.sessionHours));
  });
  // installations call these
  app.post("/api/v1/heartbeat", (req, res) => send(res, heartbeat(db, parse(heartbeatInput, req.body), req.ip ?? null)));
  app.get("/api/v1/keys", (_req, res) => send(res, trustedKeys(db)));

  /* everything else needs a session */
  const session = requireSession(db);
  const issuer = requireRole("issuer");
  const owner = requireRole("owner");

  app.post("/api/auth/logout", session, (req, res) => {
    logout(db, req.token!);
    send(res, null, { message: "Signed out" });
  });
  app.get("/api/auth/me", session, (req, res) => send(res, req.user));

  app.get("/api/overview", session, (_req, res) => send(res, overview(db)));

  app.get("/api/customers", session, (req, res) =>
    send(res, listCustomers(db, config, { q: query(req, "q"), archived: query(req, "archived") === "1" })),
  );
  app.post("/api/customers", session, issuer, (req, res) => {
    const { customer, registered } = createCustomer(db, config, req.user!, parse(customerInput, req.body));
    send(res, customer, {
      status: 201,
      message: registered
        ? `Created ${customer.name.en}; customers/${customer.id}/customer.json was added so builds can be composed for it`
        : `Created ${customer.name.en}`,
    });
  });
  app.get("/api/customers/:id", session, (req, res) => send(res, getCustomer(db, config, req.params.id as string)));
  app.put("/api/customers/:id", session, issuer, (req, res) =>
    send(res, updateCustomer(db, config, req.user!, req.params.id as string, parse(customerUpdate, req.body)), { message: "Saved" }),
  );
  app.put("/api/customers/:id/theme", session, issuer, (req, res) =>
    send(res, setCustomerTheme(db, config, req.user!, req.params.id as string, parse(themeInput, req.body)), {
      message: "Saved — applies from the customer's next build",
    }),
  );
  app.post("/api/customers/:id/archive", session, issuer, (req, res) =>
    send(res, setArchived(db, config, req.user!, req.params.id as string, true), { message: "Archived" }),
  );
  app.post("/api/customers/:id/restore", session, issuer, (req, res) =>
    send(res, setArchived(db, config, req.user!, req.params.id as string, false), { message: "Restored" }),
  );
  app.get("/api/customers/:id/installations", session, (req, res) => {
    getCustomer(db, config, req.params.id as string);
    send(res, listInstallations(db, { customerId: req.params.id as string }));
  });
  app.post("/api/customers/:id/installations", session, issuer, (req, res) => {
    const installation = createInstallation(db, req.user!, req.params.id as string, parse(installationInput, req.body));
    send(res, installation, { status: 201, message: `Added ${installation.label}` });
  });

  app.get("/api/installations", session, (req, res) => send(res, listInstallations(db, { customerId: query(req, "customerId") })));
  app.get("/api/installations/:id", session, (req, res) => send(res, getInstallation(db, req.params.id as string)));
  app.put("/api/installations/:id", session, issuer, (req, res) =>
    send(res, updateInstallation(db, req.user!, req.params.id as string, parse(installationInput, req.body)), { message: "Saved" }),
  );
  app.post("/api/installations/:id/retire", session, issuer, (req, res) =>
    send(res, retireInstallation(db, req.user!, req.params.id as string), { message: "Retired; its licence was revoked" }),
  );

  // a release: an installation's HIS built from its active licence, as the bundle the hospital installs
  app.post("/api/installations/:id/releases", session, issuer, (req, res) => {
    const release = startRelease(db, config, req.user!, req.params.id as string);
    send(res, release, { status: 202, message: "The build has started" });
  });
  app.get("/api/installations/:id/releases", session, (req, res) =>
    send(res, listReleases(db, config, { installationId: req.params.id as string })),
  );
  app.get("/api/releases", session, (req, res) => send(res, listReleases(db, config, { customerId: query(req, "customerId") })));
  app.get("/api/releases/:id", session, (req, res) => send(res, getRelease(db, config, req.params.id as string)));
  // the bundle carries the licence: issuers only, like the licence file
  app.get("/api/releases/:id/bundle", session, issuer, (req, res) => {
    const bundle = releaseBundle(db, req.params.id as string);
    // the path is the release's own, from the database; it sits under .data, which send refuses by default
    res.download(bundle.path, bundle.name, { dotfiles: "allow" });
  });

  app.get("/api/licences", session, (req, res) => {
    const status = query(req, "status");
    const display = query(req, "display");
    send(
      res,
      listLicences(db, {
        customerId: query(req, "customerId"),
        installationId: query(req, "installationId"),
        status: status === "active" || status === "superseded" || status === "revoked" ? status : undefined,
        display: (["valid", "warning", "grace", "read-only", "revoked", "superseded", "expiring"] as const).find((d) => d === display),
        q: query(req, "q"),
      }),
    );
  });
  app.post("/api/licences", session, issuer, (req, res) => {
    const licence = issueLicence(db, config, req.user!, parse(issueInput, req.body));
    send(res, licence, { status: 201, message: licence.supersedes ? "Licence renewed" : "Licence issued" });
  });
  app.get("/api/licences/:id", session, (req, res) => send(res, getLicence(db, req.params.id as string)));
  // the file itself, as the hospital receives it — not the envelope. Issuers
  // only: with its ids it is what an installation's heartbeat presents.
  app.get("/api/licences/:id/file", session, issuer, (req, res) => {
    const licence = getLicence(db, req.params.id as string);
    // the installation in the name, so a customer's production and test files are never mixed up
    const label = licence.installationLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "installation";
    res
      .type("application/json")
      .attachment(`licence-${licence.customerId}-${label}-${licence.expiresOn}.json`)
      .send(formatLicenceFile(licence.file));
  });
  app.post("/api/licences/:id/revoke", session, issuer, (req, res) => {
    const { licence, restored } = revokeLicence(db, req.user!, req.params.id as string, parse(revokeInput, req.body).reason);
    send(res, licence, {
      message: restored ? `Licence revoked; the licence it replaced (${restored.slice(0, 8)}) is active again` : "Licence revoked",
    });
  });

  app.get("/api/catalog", session, (_req, res) => send(res, listProducts(db)));
  app.post("/api/catalog/sync", session, issuer, (req, res) => {
    const result = syncCatalog(db, config, req.user!);
    send(res, listProducts(db), {
      message: result.problems.length
        ? `Synced ${result.products} product(s); ${result.problems.length} manifest(s) could not be read: ${result.problems.join("; ")}`
        : `Synced ${result.products} product(s) from the repository`,
    });
  });

  app.get("/api/keys", session, (_req, res) => send(res, listKeys(db)));
  app.post("/api/keys/rotate", session, owner, (req, res) => {
    const kid = createKey(db, config, req.user!);
    send(res, listKeys(db), { message: `New signing key ${kid} is active; older keys stay trusted` });
  });

  app.get("/api/audit", session, (req, res) =>
    send(
      res,
      listAudit(db, {
        limit: Number.isFinite(Number(query(req, "limit"))) ? Number(query(req, "limit")) : 100,
        targetType: query(req, "targetType"),
        targetId: query(req, "targetId"),
        customerId: query(req, "customerId"),
      }),
    ),
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: "No such endpoint" } });
  });
  app.use(errorHandler);
  return app;
}
