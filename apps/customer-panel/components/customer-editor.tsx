"use client";

import { ActionBar, Button, cn, Meta, Panel, PanelBody, PanelHeader, Segmented } from "@his/ui";
import type { Theme } from "@his/ui/theme";
import { ExternalLink, RotateCcw, Save } from "lucide-react";
import { type CSSProperties, useEffect, useState, useTransition } from "react";
import { saveCustomer } from "@/app/actions";
import { controlAppearanceUrl, THEME_LABELS } from "@/lib/themes";
import type { ActionResult, CustomerConfig, CustomerEdit, ProductCatalog } from "@/lib/types";
import { Notice, TextField } from "./fields";

export function CustomerEditor({
  config,
  catalog,
  onDirtyChange,
}: {
  config: CustomerConfig;
  catalog: ProductCatalog;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const allIds = catalog.products.map((p) => p.id);
  const [name, setName] = useState(config.name);
  const [all, setAll] = useState(config.products === "*");
  const [picked, setPicked] = useState<string[]>(config.products === "*" ? allIds : config.products);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, startSaving] = useTransition();

  // catalog order, then anything unknown (which the server will refuse, by name)
  const ordered = (list: string[]) => [...allIds.filter((id) => list.includes(id)), ...list.filter((id) => !allIds.includes(id))];
  const edit: CustomerEdit = {
    name: { en: name.en.trim(), ar: name.ar.trim() },
    products: all ? "*" : ordered(picked),
  };
  const saved: CustomerEdit = {
    name: config.name,
    products: config.products === "*" ? "*" : ordered(config.products),
  };
  const dirty = JSON.stringify(edit) !== JSON.stringify(saved);
  const unknown = all ? [] : picked.filter((id) => !allIds.includes(id));

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  function save() {
    startSaving(async () => {
      setResult(await saveCustomer(config.id, edit));
    });
  }

  function revert() {
    setName(config.name);
    setAll(config.products === "*");
    setPicked(config.products === "*" ? allIds : config.products);
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl leading-tight font-semibold tracking-tight text-heading-ink">{config.name.en}</h2>
        <p className="mt-1 text-sm text-ink-3">
          <code className="font-mono">customers/{config.id}/customer.json</code>
        </p>
      </div>

      <Panel>
        <PanelHeader level="h3" title="Identity" />
        <PanelBody className="grid gap-4 md:grid-cols-3">
          <TextField label="Customer id" value={config.id} readOnly hint="The folder name; it cannot be changed here." />
          <TextField
            label="Name (English)"
            value={name.en}
            maxLength={120}
            onChange={(e) => setName({ ...name, en: e.target.value })}
          />
          <TextField
            label="Name (Arabic)"
            value={name.ar}
            maxLength={120}
            dir="rtl"
            lang="ar"
            onChange={(e) => setName({ ...name, ar: e.target.value })}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          level="h3"
          title="Products"
          meta={<Meta>{all ? "all products" : `${edit.products.length} of ${allIds.length}`}</Meta>}
        />
        <PanelBody className="flex flex-col gap-3">
          <Segmented
            className="self-start"
            label="Which products"
            value={all ? "all" : "pick"}
            onChange={(v) => setAll(v === "all")}
            options={[
              { value: "all", label: "All products (*)" },
              { value: "pick", label: "Choose products" },
            ]}
          />
          <p className="text-sm text-ink-3">
            {all
              ? "Every package with a his.product.json — including products added later."
              : "Only the ticked products are composed; the others are left out of the build entirely."}
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {catalog.products.map((p) => {
              const on = all || picked.includes(p.id);
              return (
                <li key={p.id}>
                  <label
                    className={cn(
                      "flex gap-3 rounded-ctl border p-3",
                      on ? "border-accent-line bg-accent-soft" : "border-line bg-surface",
                      all ? "cursor-default" : "cursor-pointer hover:bg-surface-2",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-accent"
                      checked={on}
                      disabled={all}
                      onChange={(e) =>
                        setPicked(e.target.checked ? [...picked, p.id] : picked.filter((id) => id !== p.id))
                      }
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium text-ink">
                        {p.name.en}{" "}
                        <span lang="ar" className="font-normal text-ink-3">
                          · {p.name.ar}
                        </span>
                      </span>
                      <span className="text-xs text-ink-3">
                        <code className="font-mono">{p.id}</code> · <code className="font-mono">{p.package}</code>
                      </span>
                      <span className="text-xs text-ink-3">
                        Pages: {p.routes.map((r) => `/${r}`).join(", ") || "none"}
                        {p.slots.length ? ` · outlets: ${p.slots.join(", ")}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {catalog.products.length === 0 ? <Notice title="No products found: no packages/*/his.product.json." /> : null}
          {unknown.length ? (
            <Notice tone="problem" title={`Not a product any more: ${unknown.join(", ")}`}>
              Untick it, or restore its his.product.json — compose refuses unknown products.
            </Notice>
          ) : null}
          {catalog.problems.length ? (
            <Notice tone="problem" title="Some product manifests cannot be read">
              <ul className="list-disc ps-5">
                {catalog.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
        </PanelBody>
      </Panel>

      <ThemesPanel config={config} />

      <Panel>
        <PanelHeader level="h3" title="Customer's own code" meta={<Meta>read-only</Meta>} />
        <PanelBody className="text-sm text-ink-2">
          {config.ownPackage || config.extensions.routes.length || config.extensions.nav || config.extensions.slots.length ? (
            <>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
                <dt className="text-ink-3">Package</dt>
                <dd>
                  <code className="font-mono">{config.ownPackage ?? "—"}</code>
                </dd>
                <dt className="text-ink-3">Pages</dt>
                <dd>{config.extensions.routes.map((r) => `/${r}`).join(", ") || "—"}</dd>
                <dt className="text-ink-3">Nav items</dt>
                <dd>{config.extensions.nav}</dd>
                <dt className="text-ink-3">Outlets</dt>
                <dd>{config.extensions.slots.join(", ") || "—"}</dd>
              </dl>
              <p className="mt-2 text-xs text-ink-3">
                Saved back exactly as they are. To change them, edit customers/{config.id}/customer.json.
              </p>
            </>
          ) : (
            <p>None — this customer has no code of its own.</p>
          )}
        </PanelBody>
      </Panel>

      <ActionBar>
        <Button tone="primary" onClick={save} disabled={!dirty || saving}>
          <Save aria-hidden />
          {saving ? "Checking and saving…" : "Save"}
        </Button>
        <Button tone="ghost" onClick={revert} disabled={!dirty || saving}>
          <RotateCcw aria-hidden />
          Revert
        </Button>
        <span role="status" className="ms-auto truncate text-sm text-ink-3">
          {dirty ? "Unsaved changes" : result?.ok ? result.message : "No changes"}
        </span>
      </ActionBar>
      {result && !result.ok ? (
        <Notice tone="problem" title="Not saved" output={result.output}>
          <ul className="list-disc ps-5">
            {result.error.split("\n").map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  );
}

/**
 * A theme's accent colour. data-theme on the element is enough: every
 * theme's tokens are scoped to [data-theme]. The custom theme takes the
 * hospital's colour the way <html> does, as --brand-custom.
 */
function Swatch({ theme, brand }: { theme: Theme; brand: string | null }) {
  return (
    <span
      aria-hidden
      data-theme={theme}
      style={theme === "custom" && brand ? ({ "--brand-custom": brand } as CSSProperties) : undefined}
      className="size-4 shrink-0 rounded-ctl border border-line bg-accent"
    />
  );
}

/** The customer's themes, read-only: they are set in the control app. */
function ThemesPanel({ config }: { config: CustomerConfig }) {
  const { theme } = config;
  const switchable = theme.allowed.length > 1;
  return (
    <Panel>
      <PanelHeader level="h3" title="Themes" meta={<Meta>read-only</Meta>} />
      <PanelBody className="flex flex-col gap-3 text-sm text-ink-2">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2">
          <dt className="text-ink-3">Default</dt>
          <dd className="flex items-center gap-2 text-ink">
            <Swatch theme={theme.default} brand={theme.brand} />
            {THEME_LABELS[theme.default]}
          </dd>
          {/* level with the first line of chips */}
          <dt className="py-1 text-ink-3">Allowed</dt>
          <dd>
            <ul className="flex flex-wrap gap-2">
              {theme.allowed.map((name) => (
                <li key={name} className="flex items-center gap-2 rounded-ctl border border-line bg-surface px-2 py-1 text-ink">
                  <Swatch theme={name} brand={theme.brand} />
                  {THEME_LABELS[name]}
                  {name === theme.default ? <span className="text-xs text-ink-3">default</span> : null}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-ink-3">
              {switchable
                ? "Users start on the default and may switch between these; each browser remembers its choice."
                : "One fixed look: the app has no theme picker."}
            </p>
          </dd>
          <dt className="text-ink-3">Hospital colour</dt>
          <dd className="flex items-center gap-2">
            {theme.brand ? (
              <>
                <Swatch theme="custom" brand={theme.brand} />
                <code className="font-mono text-ink">{theme.brand}</code>
              </>
            ) : theme.allowed.includes("custom") ? (
              "none — users pick it"
            ) : (
              "—"
            )}
          </dd>
        </dl>
        {config.legacyTheme ? (
          <p className="text-xs text-ink-3">
            Read from the older <code className="font-mono">features.themePaletteCustomization</code> switch (on: every
            theme, off: Slate only). The control app replaces it with <code className="font-mono">theme</code> when it
            saves.
          </p>
        ) : null}
        <p className="text-xs text-ink-3">
          Edited in the control app:{" "}
          <a
            href={controlAppearanceUrl(config.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent-text underline"
          >
            {config.name.en} → Appearance
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
          . Saving here keeps it as it is; it applies the next time this customer is composed.
        </p>
      </PanelBody>
    </Panel>
  );
}
