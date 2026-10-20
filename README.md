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
| `npm test` | the panel's tests (`node:test`; temporary fixtures, never real customers) |

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
apps/customer-panel/         local admin panel: customers, products, palette permission, compose & run
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

Pick a customer (or create one), choose its products, decide whether it may
change its theme palette, **Save**, then **Compose** or **Compose & run**. The
panel runs `scripts/compose.mjs` with `HIS_CUSTOMER` set, then the showcase's
`next dev` on port 3100; **Stop** stops it. Output and exit codes are shown.

- **What it edits.** `name`, `products` and `features` in
  `customers/<id>/customer.json`. `extensions` and any other key are written
  back as they were (the file is re-written as 2-space JSON). A save is refused
  unless `compose.mjs --check` accepts the result, so a saved customer composes.
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

### Theme palette permission

```json
"features": { "themePaletteCustomization": true }
```

Every customer starts on the default palette (`slate`). The flag only decides
whether its users may change it; missing means `false`. It never assigns a
palette to a customer.

| | `false` / missing | `true` |
|---|---|---|
| `<html data-theme>` | the default; saved `his-theme` / `his-brand` cookies are ignored (kept, not deleted) | the user's choice |
| theme picker in the review bar | not rendered | shown |
| `?theme=` / `?brand=` links | removed, no cookie set | set the cookie |
| `setPref("theme" \| "brand")` | ignored while `<html data-palette="locked">` | applies |

Mode, density, navigation and language stay each user's choice either way.
compose writes the flag into `CUSTOMER.features` and `products.generated.json`;
`verify:build` checks the first three rows and the `data-palette` marker against
the running image, and `npm test` covers `setPref`.

## Not in this POC

- Overlay components (dialog, select, popover, tooltip). In HIS these would wrap
  Radix exactly as shadcn does today, styled with the same roles.
- Storybook, visual regression tests, a Figma token export.
- Chart palette tokens beyond accent and neutral.
- An ESLint rule; `lint:tokens` is a script for now.
- Product dependencies (`"requires": ["patients"]` in `his.product.json`,
  checked by compose) and a Dockerfile per customer image.
- A CI matrix that builds and verifies every customer on every pull request,
  and CODEOWNERS giving each customer folder to the team that installs it.
- Settings-driven core features (the first rung for a customer request).
