# @his/ui — design system POC

A proof of concept for the HIS frontend's next design system: semantic tokens,
switchable themes, user density, light/dark and right-to-left — built with
Tailwind CSS v4 and Next.js 16, shaped as a small monorepo so the design system
is a package, not a folder inside the app.

It restyles three screens from the restyle study (dashboard, patients, visit)
using direction **A1 — Quiet Instrument, calm sidebar** as the fixed structure.

## Run it

```bash
nvm use            # Node 22+
npm install
npm run dev        # http://localhost:3100
```

Use the bar at the top to switch theme, mode, density and language. Every
combination is also a shareable link:

```
/visit?theme=pine&mode=dark&density=comfortable&lang=ar
/?theme=custom&brand=7a3e9d
```

| Script | What it does |
|---|---|
| `npm run build` | compose the customer in `HIS_CUSTOMER` (default `all`), then build a standalone image (its postbuild copies `.next/static` and `public` in; Next leaves them out) |
| `npm run verify:build` | prove the last build holds only that customer's products (see below) |
| `npm run start` | run the standalone image |
| `npm run typecheck` | `tsc` for every package |
| `npm run lint:tokens` | fails on hex colours, raw palette classes, physical direction classes and unknown role names |
| `npm run panel` | the customer panel on http://127.0.0.1:3200 — configure, compose and run a customer ([below](#customer-panel)) |
| `npm run control` | the licence server (http://127.0.0.1:4300) and the control app (http://127.0.0.1:3300) — customers, installations and licences ([below](#licensing--the-control-plane)) |
| `npm test` | the panel's, the licence contract's and the licence server's tests (`node:test`; temporary fixtures, never real customers) |

## Layout

```
packages/ui/                 @his/ui — the design system
  src/styles/tokens.css      every token, in five layers (read this first)
  src/styles/index.css       Tailwind mapping; default palette removed
  src/theme/                 theme prefs: cookies → <html> attributes; usePref() hook
  src/components/            recipes (tailwind-variants) + React components
packages/billing/            @his/billing — a sellable product (his.product.json + pages)
packages/pharmacy/           @his/pharmacy — another one
packages/slots/              @his/slots — the outlets core pages offer (the contract)
customers/<id>/customer.json which products each customer bought
customers/al-amal/src/       one customer's own code: a page and an outlet plug
apps/showcase/               Next.js app that consumes @his/ui
  proxy.ts                   ?theme=… query → cookies (shareable links)
  app/(app)/                 design-system page, dashboard, patients, visit
  app/(app)/(composed)/      generated route shells for the composed products
  components/slot.tsx        <Slot>: an outlet a customer can plug into
  lib/not-purchased.ts       what an unpurchased product resolves to
apps/customer-panel/         local admin panel: customers, products (themes shown), compose & run
packages/licence/            @his/licence — the licence file contract: payload, sign/verify, states, the control API's types
apps/licence-server/         the control plane's API: customers, installations, signing, heartbeats (never in a customer build)
apps/control/                the control plane's console on the design system (never in a customer build)
scripts/compose.mjs          writes the customer's routes, nav, @source, config
scripts/verify-build.mjs     checks a build against its customer
scripts/check-tokens.mjs     the token guard
```

## How theming works

All state lives on `<html>`, rendered by the server from cookies, so the first
paint is already correct:

```html
<html lang="ar" dir="rtl" class="dark" data-theme="pine" data-density="comfortable" …>
```

`tokens.css` is read top to bottom:

1. **System values** — neutrals, clinical state, shape. Fixed.
2. **Accent roles** — `--accent`, `--accent-soft`, `--accent-line` … computed
   from one `--brand` colour with `color-mix()`.
3. **Themes** — a theme sets `--brand` and how the chrome carries it
   (`band`: the top bar is the brand; `plain`: the top bar is a surface).
4. **Dark mode** — the same layers, inverted; the brand is lifted for legibility.
5. **Density** — sizes and the type scale, per user.

Components only ever use roles: `bg-surface`, `text-ink-3`, `border-line`,
`bg-accent`, `text-critical`, `h-row`, `p-pad`, `rounded-ctl`. Those utilities
read CSS variables, so switching a theme or density re-styles everything with no
re-render.

### Add a hospital theme

A theme is a few lines of CSS. For a band-style chrome:

```css
[data-theme="al-amal"] { --brand: #1f6f8b; }
```

…and add the selector to the band-chrome block in `tokens.css`. The
`custom` theme shows the same thing at runtime: the server writes
`--brand-custom` (plus `--brand-custom-ink` and `--brand-custom-text`, from
`deriveBrand()`) on `<html>`, and every other shade is computed from it. A pale
brand gets dark text on its fills and a darkened text colour, so any colour a
hospital picks stays readable; the review bar warns below 4.5:1.

## HIS today — the original design system, side by side

The theme picker has a sixth entry, **HIS today** (`data-theme="original"`):
HIS-frontend's current design system, read from the code at commit
`8a3fdaeb9` — the navy gradient sidebar, the `#f8f7fa` canvas, white 15px
cards, the orange Save button, the bluish gray scale, Rubik/Almarai, 8px
controls at 40px, and its status colours. Switch between it and any new
theme to compare the same screens.

It is a reference, not one of the new themes. To look like today's app it
deliberately breaks three rules: it recolours clinical state, it changes
type and shape, and it keeps one density. HIS has no dark mode, so the dark
version is a proposal built from its palette (navy canvas and sidebar,
lifted blue, the orange Save button with dark text), held to the same
contrast as the new themes.
Its contrast failures are kept on purpose and noted in `tokens.css`.

To get there it uses a set of finer roles every theme inherits with neutral
defaults — `--card-line`, `--heading-ink`, `--thead-*`, `--cell-ink`,
`--nav-radius`/`--nav-fs`/`--nav-active-weight`, `--mark-size`/`--mark-radius`,
`--chrome-icon-*`, `--step-*` and `--accent-edge`. They are also how a real
hospital theme could adjust a detail without touching a component. It
repaints the new screens rather than copying HIS layouts, so operational
statuses stay neutral where HIS tints them.

The design-system page has a **HIS today** section documenting the original
palette (with usage counts and contrast on white), the gray scale, the 16
random appointment tints, fonts, shape, a token-by-token map from HIS to
`@his/ui` roles, and what the audit of the code found. The data lives in
`apps/showcase/lib/his-today.ts`.

## Rules the system enforces

- **Colour means clinical state.** `<Signal>` (critical, caution, stable, info)
  is the only coloured chip. Clinical colours are not theme inputs. Each tone
  also has its own marker shape (▲ ◆ ● ○) and a spoken `toneLabel`, so severity
  never depends on telling red from amber.
- **Operations stay neutral.** Billing, workflow, stock and paperwork use
  `<Status>` — neutral, square marker. An unpaid invoice never looks like an
  allergy. (The restyle study used critical red for both.)
- **The default palette does not exist.** `--color-*: initial` removes it, so
  `bg-blue-600` compiles to nothing; `lint:tokens` turns that silent failure
  into an error.
- **Direction-safe by construction.** Components use logical properties only
  (`ms-`, `ps-`, `start-`, `border-e`, `text-start`); `lint:tokens` rejects the
  physical ones. IDs and phone numbers go through `<Ltr>` (or LRI…PDI inside a
  plain string), otherwise `208-4471` renders as `4471-208` beside Arabic text.
- **Contrast is part of the token.** Text roles clear 4.5:1 and control
  boundaries 3:1 in every theme and mode. Focus rings use `--focus`, which the
  chrome band and the dark rail override (`--chrome-focus`, `--nav-focus`) —
  a ring in the brand colour would vanish on a brand-coloured band.

## Gotchas found in review

- **next/font + Arabic:** the Latin face's generated fallback (`local(Arial)`,
  no `unicode-range`) claims every Arabic glyph before the Arabic face is
  reached. `adjustFontFallback: false` on `IBM_Plex_Sans` fixes it.
- **Custom state variants beat breakpoints.** `rail-collapsed:hidden` wins over
  `max-xl:` utilities regardless of class order. Scope it:
  `xl:rail-collapsed:hidden`.
- **`overflow-hidden` clips focus rings.** Segmented rounds its first and last
  item instead.
- **`sr-only` needs a positioned ancestor** inside the scroll container, or it
  makes the whole window scroll. Components that render one are `relative`.
- **Toggles read `<html>`, not React state** (`usePref`), so back/forward and a
  language refresh never leave a label stale.

## Per-customer builds — ship only what was bought

A product is a package with a `his.product.json` (its routes and nav items). A
customer is a list of product ids. The app never imports a product by hand;
`scripts/compose.mjs` writes everything that does, for one customer:

```bash
HIS_CUSTOMER=al-amal npm run build   # billing in, pharmacy out
npm run verify:build
```

`node scripts/compose.mjs --check` runs every check and writes nothing;
`--customer-file <path>` checks (or composes) a draft definition instead of
`customers/<id>/customer.json`. A failed compose leaves the last good output in
place: every check runs before anything is written.

| Generated | For |
|---|---|
| `app/(app)/(composed)/<route>/page.tsx` | a thin route shell per product route |
| `lib/products.generated.ts` | the sidebar's product items and customer name |
| `lib/slots.generated.ts` | what this customer plugged into each outlet |
| `app/products.generated.css` | `@source` for the products that are in |
| `products.generated.json` | read by `next.config.ts` and `verify-build.mjs` |

**Three layers keep an unpurchased product out:**

1. **Nothing imports it.** No route shell, nav item or `@source` is generated.
2. **Nothing can import it.** `next.config.ts` aliases every excluded package
   to `lib/not-purchased.ts`, which fails the build. A stray import — from app
   code or from another product — stops the build with an import trace that
   names the file that reached for it.
3. **The build is checked.** `verify-build.mjs` looks for each product's marker
   strings (`*_MARK`) in `.next/server`, `.next/static` and the standalone
   image, runs the standalone server, and expects `200` on a bought product's
   routes and `404` on the rest.

Tested on the four customers in `customers/`:

| Customer | Products | `/billing/invoices` | `/pharmacy/stock` | Markers of excluded products |
|---|---|---|---|---|
| `al-amal` | billing | 200 | 404 | none |
| `al-shifa` | billing, pharmacy | 200 | 200 | — |
| `clinic-basic` | (core only) | 404 | 404 | none |
| `all` (dev default) | everything | 200 | 200 | — |

Two things the test showed:

- **`transpilePackages` is not a boundary.** Turbopack compiles any workspace
  package that is imported, listed or not. Without layer 2, a hand-written
  `import … from "@his/pharmacy/pages"` built fine for `al-amal` and shipped
  pharmacy's code; only the verify step caught it.
- **An alias to a missing path is not a boundary either.** Turbopack falls back
  to normal resolution when an alias target does not exist. The alias has to
  point at a real file that fails, which is what `not-purchased.ts` is.

## A customer's own code — without touching the core

When a customer asks for something only they need, it goes in their folder,
never in the core and never in a branch of their own. Ask first whether
another customer could want it: if so, it belongs in the core as a setting.

```
customers/al-amal/
  customer.json      products + "extensions": slots, nav, routes
  package.json       @his/customer-al-amal (exports ./pages and ./slots)
  src/slots.tsx      LoyaltyCard — plugged into the visit page's side panel
  src/pages.tsx      InsurerReport — a page only Al-Amal has
```

- **A page of their own** is composed exactly like a product's page.
- **Content inside a core page** goes through an **outlet**. The core page
  renders `<Slot name="visit.side-panel" props={…} />` at a fixed place and
  never knows who plugs in. `@his/slots` is the contract: each outlet's name
  and props (`SlotProps`), plus `outlets.json` naming the page it is on.
  compose writes `slots.generated.ts` for the chosen customer, so Al-Amal's
  visit page shows the loyalty card and every other customer's outlet is
  empty.
- Outlets are added one at a time, when a customer needs one. Each is a
  contract the core keeps.

What breaks, and who notices (all four were tried):

| The core team… | Caught by |
|---|---|
| renames an outlet prop (`patientId` → `patient`) | Al-Amal's typecheck, in the same PR — `Property 'patientId' does not exist` |
| removes an outlet from the contract | compose refuses Al-Amal: "plugs into outlet "visit.side-panel", but no core page offers it" |
| drops `<Slot>` from the page, keeps the contract | `verify:build` for Al-Amal: the outlet no longer shows its content |
| imports Al-Amal's code into the core | Al-Shifa's build fails: the package is aliased to `not-purchased.ts` |

The first and last only show up when every customer is built on every pull
request, which is why customer code lives in this repository.

## Customer panel

A local admin page for the steps above, so nobody has to set `HIS_CUSTOMER` in
a terminal:

```powershell
npm install
npm run panel        # http://127.0.0.1:3200 — answers on this machine only
```

Pick a customer (or create one), choose its products, **Save**, then
**Compose** or **Compose & run**. The panel runs `scripts/compose.mjs` with
`HIS_CUSTOMER` set, then the showcase's `next dev` on port 3100; **Stop** stops
it. Output and exit codes are shown. A customer's themes are shown, not edited
([below](#a-customers-themes)).

- **What it edits.** `name` and `products` in `customers/<id>/customer.json`.
  `theme`, `features`, `extensions` and any other key are written back as they
  were (the file is re-written as 2-space JSON). A save is refused unless
  `compose.mjs --check` accepts the result, so a saved customer composes.
- **One thing at a time.** compose rewrites `apps/showcase` in place and its
  `next.config.ts` reads the result only at startup, so there is one
  composition and at most one showcase. Compose and run are refused while the
  panel's showcase runs — stop it first — and while something else holds port
  3100 (a terminal `npm run dev`, say). The panel never stops a process it did
  not start; that one you stop yourself.
- **When the panel goes away, so does its showcase** on Windows: Node keeps
  child processes in the parent's job, so they end with it, even on a hard
  kill. On macOS/Linux (not tested) a hard-killed panel may leave the showcase
  running; the next panel then reports port 3100 as taken.
- **Local only.** It edits files and runs a dev server on this machine. It does
  not deploy, bill or build images — `npm run build` and `verify:build` stay
  the way to make and check one.

### A customer's themes

```json
"theme": { "default": "pine", "allowed": ["pine", "custom"], "brand": "#1f6f8b" }
```

Which themes a customer's users get. It is set in the **control app**
(customer → Appearance; the licence server's `PUT /api/customers/:id/theme`
writes `customer.json`, keeps every other key and drops the old switch). The
panel only shows it, with a link there.

- `allowed` — one or more of @his/ui's `THEMES` (slate, ink, pine, graphite,
  custom, original). One is a fixed look; several let each user switch.
- `default` — one of `allowed`: the first paint, and where a saved theme the
  customer does not have falls back to.
- `brand` — the hospital's colour for the custom theme, or `null`: users pick it.

Without `theme`, the older `features.themePaletteCustomization` keeps its
meaning: `true` = every theme, `false` or missing = slate only. compose checks
`theme` and writes it to `CUSTOMER.theme` (a `ThemePolicy`) and
`products.generated.json`, with the flag still beside it, derived: may users
change anything at all.

| In the showcase | |
|---|---|
| `<html data-theme>` | the saved `his-theme` cookie if allowed, else `default` (the cookie is kept); the custom colour is `brand` when set (`applyThemePolicy`) |
| theme picker in the review bar | the allowed themes when there are several, the colour input when users pick it; not rendered when nothing is left to choose |
| `?theme=` / `?brand=` links | removed from the URL; a cookie only for a theme users may switch to, or a colour they may pick |
| `setPref("theme")` | ignored for a theme not in `<html data-themes="pine custom">` (written only when some theme is left out) |
| `setPref("brand")` | ignored while `<html data-brand="locked">` (the hospital has a colour) |
| `setPref("theme" \| "brand")` | ignored while `<html data-palette="locked">`: nothing left to choose |

Mode, density, navigation and language stay each user's choice either way.
`verify:build` checks the first paint, the `<html>` markers, the picker, saved
cookies and the links against the running image; `npm test` covers compose,
`applyThemePolicy`, `themeChoices` and `setPref`.

## Licensing — the control plane

Customers run HIS on their own servers, some online and some air-gapped. What
a customer bought is decided in one place — the **control plane** — and
reaches the hospital as a signed licence file. Two halves, never mixed:

| | Where | Does |
|---|---|---|
| **Issuing** | `apps/licence-server` (API) + `apps/control` (console) | customers, installations, the catalog, signing, renewal, revocation, heartbeats, the audit log |
| **Checking** | `scripts/compose.mjs` + `apps/showcase` | builds only the licensed products, verifies the licence, shows its state, turns read-only when it is over |

The issuing half is never part of a customer build, and the private signing
key never leaves the licence server.

```bash
npm run control      # licence server on :4300, console on :3300
```

On its first start the licence server creates an owner account (the password
is in `apps/licence-server/.data/initial-owner.txt`, or set
`CONTROL_OWNER_PASSWORD`), a signing key, publishes the public keys to
`packages/licence/trusted-keys.json`, reads the catalog from
`packages/*/his.product.json`, and imports the customers in `customers/`
(not `all`, the developers' everything-build). `.data/` and the published
keys are git-ignored.

### The licence

```jsonc
{
  "format": "his-licence",
  "payload": {
    "v": 1, "kid": "k20261022-2zcu",            // which key signed it — keys can rotate
    "licenceId": "…", "customerId": "al-amal", "customerName": { "en": "…", "ar": "…" },
    "installationId": "…",                      // one deployment: production, a test copy, a second site
    "issuedAt": "2026-10-22T09:15:00Z",         // also a floor for the clock
    "expiresOn": "2027-10-21", "warnDays": 30, "graceDays": 14,
    "products": ["billing", "pharmacy"]         // catalog ids; core is always in
  },
  "signature": "…"                              // Ed25519 over canonical(payload)
}
```

A licence never stops a hospital:

```
valid ──(warnDays before)──▶ expiring ──(expiresOn)──▶ grace ──(graceDays)──▶ read-only
```

Read-only keeps viewing, printing and exporting, and refuses new records.
`evaluateLicence()` in `@his/licence` is the one place that decides the state,
for the console and for every build alike. A clock turned back does not
extend a licence: the installation remembers the latest time it has seen, and
the licence's own `issuedAt` is a floor.

### The console

- **Overview** — counts, and what needs someone today: read-only, in grace,
  two running copies of one licence, expiring, online but silent, no licence.
- **Customers** → a customer's details, **installations** (each with its
  licence, last heartbeat and running copies), licences and activity.
  Creating a customer also writes `customers/<id>/customer.json`, so compose
  can build for it.
- **Issue / renew** — a four-step wizard: installation, products, term (with
  a live timeline), review and sign. A renewal counts from the day after the
  current licence ends, so no paid day is lost, and shows what was added or
  removed. Signing supersedes the installation's active licence.
- **Licence** — where it stands on its timeline, its products, the signed file
  (download or copy; issuers only), delivery instructions for online and
  offline sites, and revoke (with a reason). **Revoking a renewal undoes it:**
  the licence it replaced — which the hospital paid for — is current again,
  and an online installation gets it back at its next heartbeat. To end that
  one too, revoke it next. Retiring an installation revokes its licence and
  restores nothing.
- **Products**, **Signing keys** (rotate: owner only; old keys stay trusted),
  **Activity log** (every change, who, when).

Roles: `owner` (everything, keys included), `issuer` (customers,
installations, licences), `viewer` (read only). The browser never holds the
session token: the console keeps it in an httpOnly cookie and calls the
licence server from its own server.

Licence states are operational, not clinical, so the console shows them as
neutral `<Status>`, never with clinical colours.

### In a customer build

```bash
HIS_CUSTOMER=al-amal node scripts/compose.mjs --licence licence-al-amal-main-hospital-2027-11-03.json
```

- **compose** verifies the licence against `packages/licence/trusted-keys.json`
  (`HIS_LICENCE_KEYS` overrides), refuses one for another customer, and takes
  the products from the licence instead of `customer.json`. It embeds the
  trusted public keys in the build (`lib/licence.generated.ts`) and installs
  the file in the licence store. Without `--licence` it composes as before and
  licensing is off (a development build).
- **compose refuses to change the composition under a running showcase**
  (`apps/showcase/.next/dev/lock` names a live `next dev`): that server read
  its composition when it started, so composing another customer under it
  gives "Can't resolve 'HIS_PRODUCT_NOT_PURCHASED'". Stop it, compose, start
  it again. Recomposing the same customer and products (a renewed licence) is
  allowed; `--force` skips the check.
- **The licence store** is `HIS_LICENCE_DIR` (default `apps/showcase/.licence`):
  `license.json` and `state.json` (the clock high-water mark, this copy's
  instance id, a revocation learned by heartbeat, the last heartbeat).
  `HIS_INSTALLATION_ID`, when set, must match the licence.
- **Every page** shows a banner while the licence is expiring, in grace or
  read-only (or missing/invalid, which reads as read-only). In read-only the
  buttons that create records are disabled with the reason.
- **Setup → Licence** shows the licence, its timeline and products (marking any
  licensed but not in this build, which needs an updated build), the last
  heartbeat, and installs a renewed file. An older licence is refused, except
  from the licence server itself (a revoked renewal hands back the one it
  replaced).
- A product route whose product the installed licence no longer lists answers
  404, and leaves the sidebar.
- **Online sites** set `HIS_LICENCE_SERVER_URL` (and optionally
  `HIS_HEARTBEAT_SECONDS`, default 3600). The heartbeat runs from
  `instrumentation.ts`; a failure is logged and never blocks anything.

### Delivery

| Installation | How a new licence arrives |
|---|---|
| online | at its next heartbeat (`POST /api/v1/heartbeat`): the answer carries the renewed licence, or says it was revoked (it then ends that day, grace still applies) |
| offline | the file is downloaded from the console and delivered; the hospital's administrator installs it on HIS → Licence. Nothing restarts |

A product added to a licence still needs a new build: compose is what puts its
code on the server.

### Releases — the one file a hospital installs

**Build release** on an installation (Customers → the customer → Installations)
builds that installation's HIS from its active licence. The release page
follows the eight steps and the log as it runs, and ends with **Download
bundle** and the commands to give the hospital. The same build from a shell:

```bash
node scripts/release.mjs --licence licence-al-amal-main-hospital-2027-11-03.json --label "Main hospital"
```

Each build works in a throwaway copy of the repository, so the working tree
and a running dev server are never touched:

1. copy the repository (`node_modules` as an APFS clone)
2. compose from the licence
3. `next build` (standalone)
4. verify the build: it starts, licensed routes answer, unlicensed ones 404
5. `docker build` — `apps/showcase/Dockerfile`: `node:22-alpine`, runs as
   `node`, the licence store is the volume `/data/licence`
6. `docker save` into the bundle (`--registry` pushes the image instead)
7. write the bundle
8. pack it into one `.tar.gz`

```
his-al-amal-main-hospital-0.1.0-202610221202/
  install.sh            checks, loads the image, installs, starts, checks the licence
  docker-compose.yml    one service, restarts unless stopped, healthcheck on /api/licence-status
  .env                  installation id, version, port; online: the licence server's URL
  licence/license.json  the signed licence it was built from
  image/…tar.gz         the image (install.sh checks its sha256)
  release.json, README.txt
```

At the hospital (Linux with Docker Engine 24+ and Docker Compose v2):

```bash
tar -xzf his-al-amal-main-hospital-0.1.0-202610221202.tar.gz
cd his-al-amal-main-hospital-0.1.0-202610221202
sudo ./install.sh                     # into /opt/his/al-amal; another port: sudo HIS_PORT=8090 ./install.sh
```

- It ends with exit 0 when HIS runs with a valid licence, exit 2 when it runs
  read-only.
- **Upgrading is running a newer bundle's `install.sh`.** The licence store
  (a renewal uploaded since, the clock high-water mark, the instance id) and
  the port are kept; the bundle's licence replaces the installed one only if it
  is newer (`issuedAt`).
- An **online** installation's bundle carries the licence server's address as
  its containers reach it: `CONTROL_PUBLIC_URL`, by default
  `http://host.docker.internal:4300`. Its first heartbeat goes out at start.
- `GET /api/licence-status` on HIS (state, products, heartbeat; no ids) answers
  the installer and the healthcheck.

**A build is its own process.** The licence server starts `release.mjs`
detached, writing to `.data/releases/<id>.log`, and keeps its pid. Progress
and the result are read from the log; a release ends when its process is gone.
A restart of the licence server — a deploy, or `node --watch` — does not stop
a build: the next start settles it from its log.

Found while building it:

- An APFS clone of `node_modules` fires file events on the *source* files, so a
  `node --watch` process restarts — which is why the build must not be the
  server's child.
- `node --watch` leaves `WATCH_REPORT_DEPENDENCIES` in its children's
  environment; `next build`'s workers then post their module lists over IPC
  and the build dies with "Unexpected response from worker". `release.mjs`
  drops it.
- Tailwind v4 skips git-ignored paths when it scans for classes. A `releases/`
  ignore rule silently dropped every class used only under
  `apps/control/app/(console)/releases/`; the rule is `/releases/`.
- Express's `res.download` refuses a path through a dot-folder (`.data/`)
  unless told `dotfiles: "allow"`.

### What the POC leaves for production

Found by a review of this code; none is a bug in the POC's own terms, all
matter before a real hospital.

- **The heartbeat is not authenticated.** It proves only an installation id
  and a licence id, both printed in every licence file, so anyone with an old
  file of an installation receives its renewals and can post fake heartbeats
  (hiding a "silent" alert or faking a "two copies" one). Give each
  installation a secret or a key pair of its own, rate-limit the endpoint, and
  prune old heartbeats.
- **Key rotation needs stages.** A new key is active at once, but a build
  trusts only the keys it was composed with, so after a rotation every renewal
  fails on sites not rebuilt yet (air-gapped ones drift to read-only). It needs
  publish-next-key → ship builds → activate, and a way to stop trusting a
  compromised key. `trusted-keys.json` is git-ignored here; CI must fetch the
  keys from the control plane (`GET /api/v1/keys`).
- **The clock high-water mark only moves forward.** One saved jump to 2030
  makes every licence read-only, and no renewal helps. It needs a signed reset
  from the control plane.
- The private key is a file (0600) on the licence server; production keeps it
  in a secret store or HSM.
- No user management or password change yet (users are created by code); the
  first owner password stays in `.data/initial-owner.txt` until deleted. The
  console answers on localhost only; production puts it behind the VPN with a
  real host check, and sets the cookie `secure` explicitly.
- SQLite stands in for the monolith's Postgres; the tables map one to one.
  Lists query per installation (N+1), fine for tens of customers.
- On the HIS side, read-only is enforced in the UI only, and anyone who can
  open the Licence page can install a licence. The backend must refuse writes
  and the install needs an admin permission.
- **Releases build on the licence server's machine, one at a time.** In
  production the same script runs as a CI job with a build cache, and bundles
  go to object storage with a retention rule; here they stay in
  `.data/releases` (with the unpacked folder) until removed. A CI job id then
  replaces the pid, which the system reuses eventually.
- **The bundle is not signed.** `install.sh` checks the image's sha256 against
  a value in the same bundle, which catches a damaged copy, not a tampered one.
  Sign the bundle (or the image, with cosign) and check it before loading.
- The installer does not refuse an older version (a downgrade); it trusts the
  person running it. The image is the frontend only: the monolith backend is
  another image to add to `docker-compose.yml`.
- JavaScript on a customer's server can be patched. The real protection is
  that unbought code is not on the server at all (compose); the signature
  protects dates, products and the installation they are for.

## Not in this POC

- Overlay components (dialog, select, popover, tooltip). In HIS these would wrap
  Radix exactly as shadcn does today, styled with the same roles.
- Storybook, visual regression tests, a Figma token export.
- Chart palette tokens beyond accent and neutral.
- An ESLint rule; `lint:tokens` is a script for now.
- Product dependencies (`"requires": ["patients"]` in `his.product.json`,
  checked by compose).
- A CI matrix that builds and verifies every customer on every pull request,
  and CODEOWNERS giving each customer folder to the team that installs it.
- Settings-driven core features (the first rung for a customer request).
