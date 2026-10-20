"use client";

import { ActionBar, Button, cn, Meta, Panel, PanelBody, PanelHeader, Segmented } from "@his/ui";
import { RotateCcw, Save } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { saveCustomer } from "@/app/actions";
import type { ActionResult, CustomerConfig, CustomerEdit, ProductCatalog } from "@/lib/types";
import { Notice, Switch, TextField } from "./fields";

export type Palettes = { themes: string[]; fallback: string };

export function CustomerEditor({
  config,
  catalog,
  palettes,
  onDirtyChange,
}: {
  config: CustomerConfig;
  catalog: ProductCatalog;
  palettes: Palettes;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const allIds = catalog.products.map((p) => p.id);
  const [name, setName] = useState(config.name);
  const [all, setAll] = useState(config.products === "*");
  const [picked, setPicked] = useState<string[]>(config.products === "*" ? allIds : config.products);
  const [palette, setPalette] = useState(config.features.themePaletteCustomization);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, startSaving] = useTransition();
  const ids = { label: useId(), help: useId() };

  // catalog order, then anything unknown (which the server will refuse, by name)
  const ordered = (list: string[]) => [...allIds.filter((id) => list.includes(id)), ...list.filter((id) => !allIds.includes(id))];
  const edit: CustomerEdit = {
    name: { en: name.en.trim(), ar: name.ar.trim() },
    products: all ? "*" : ordered(picked),
    features: { themePaletteCustomization: palette },
  };
  const saved: CustomerEdit = {
    name: config.name,
    products: config.products === "*" ? "*" : ordered(config.products),
    features: config.features,
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
    setPalette(config.features.themePaletteCustomization);
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

      <Panel>
        <PanelHeader level="h3" title="Theme palette" />
        <PanelBody>
          <div className="flex items-start gap-4">
            <Switch checked={palette} onChange={setPalette} labelledBy={ids.label} describedBy={ids.help} />
            <div className="flex min-w-0 flex-col gap-2">
              <span id={ids.label} className="font-semibold text-ink">
                Allow theme palette changes
              </span>
              <dl id={ids.help} className="flex flex-col gap-1 text-sm">
                <div className={palette ? "text-ink" : "text-ink-3"}>
                  <dt className="inline font-semibold">On: </dt>
                  <dd className="inline">
                    users can switch between the palettes the design system ships ({palettes.themes.join(", ")}) in
                    the theme bar; each browser remembers its choice.
                  </dd>
                </div>
                <div className={palette ? "text-ink-3" : "text-ink"}>
                  <dt className="inline font-semibold">Off (default): </dt>
                  <dd className="inline">
                    the app always uses the default palette ({palettes.fallback}). The theme picker is hidden, and
                    saved choices or ?theme= links are ignored.
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-ink-3">
                Light/dark mode and density stay each user&apos;s choice either way. Applies the next time this customer
                is composed.
              </p>
            </div>
          </div>
        </PanelBody>
      </Panel>

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
