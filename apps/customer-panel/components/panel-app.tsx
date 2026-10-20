"use client";

import { Button, cn, Status } from "@his/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { type MouseEvent, useCallback, useEffect, useState } from "react";
import type { CustomerEntry, ProductCatalog, RunStatus } from "@/lib/types";
import { CustomerEditor, type Palettes } from "./customer-editor";
import { Notice } from "./fields";
import { NewCustomer } from "./new-customer";
import { RunPanel } from "./run-panel";

export function PanelApp({
  customers,
  catalog,
  initialStatus,
  selectedId,
  palettes,
}: {
  customers: CustomerEntry[];
  catalog: ProductCatalog;
  initialStatus: RunStatus;
  selectedId: string | null;
  palettes: Palettes;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);
  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/run", { cache: "no-store" });
      if (response.ok) {
        const next: RunStatus = await response.json();
        setStatus(next);
      }
    } catch {
      // the panel is restarting; the next poll tries again
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [refresh]);

  const leave = (event: MouseEvent) => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) event.preventDefault();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex h-topbar shrink-0 items-center gap-3 border-b border-chrome-line bg-chrome px-gutter text-chrome-ink">
        <span aria-hidden className="grid size-7 place-items-center rounded-ctl bg-mark text-sm font-bold text-mark-ink">
          M
        </span>
        <div className="min-w-0">
          <h1 className="text-md leading-tight font-semibold">Customer panel</h1>
          <p className="truncate text-xs text-chrome-ink-dim">Configure HIS customers and run their app locally</p>
        </div>
        <RunBadge status={status} />
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-6 px-gutter py-page-y lg:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[17rem_minmax(0,1fr)_26rem]">
        <aside aria-label="Customers" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Customers</h2>
            <Button size="sm" onClick={() => setCreating(!creating)} aria-expanded={creating}>
              <Plus aria-hidden />
              New
            </Button>
          </div>
          {creating ? <NewCustomer onClose={() => setCreating(false)} /> : null}
          <ul className="flex flex-col gap-1">
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/?customer=${encodeURIComponent(c.id)}`}
                  onClick={leave}
                  aria-current={c.id === selectedId ? "page" : undefined}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-ctl border px-3 py-2",
                    c.id === selectedId ? "border-accent-line bg-accent-soft" : "border-transparent hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{c.config?.name.en ?? c.id}</span>
                    {status.server?.customerId === c.id ? <Status state="done">running</Status> : null}
                    {status.composed?.customerId === c.id && status.server?.customerId !== c.id ? (
                      <Status state="quiet">composed</Status>
                    ) : null}
                    {c.config ? null : <Status state="attention">invalid</Status>}
                  </span>
                  <span className="truncate text-xs text-ink-3">
                    <code className="font-mono">{c.id}</code>
                    {c.config ? ` · ${summary(c.config.products)}` : ""}
                    {c.config?.features.themePaletteCustomization ? " · palette changeable" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {customers.length === 0 ? <p className="text-sm text-ink-3">No customers yet — create the first one.</p> : null}
        </aside>

        {selected?.config ? (
          <>
            <main className="min-w-0">
              <CustomerEditor
                key={selected.id}
                config={selected.config}
                catalog={catalog}
                palettes={palettes}
                onDirtyChange={setDirty}
              />
            </main>
            <div className="min-w-0 lg:col-start-2 2xl:sticky 2xl:top-[calc(var(--topbar-h)+1.5rem)] 2xl:col-start-3">
              <RunPanel status={status} customerId={selected.id} dirty={dirty} onChange={refresh} />
            </div>
          </>
        ) : (
          <main className="min-w-0">
            {selected ? (
              <Notice tone="problem" title={`customers/${selected.id}/customer.json cannot be edited here`}>
                {selected.problem} Fix the file by hand; the panel lists it again once it reads.
              </Notice>
            ) : (
              <p className="text-ink-3">Choose a customer, or create one.</p>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

function summary(products: "*" | string[]) {
  if (products === "*") return "all products";
  if (products.length === 0) return "core only";
  return products.join(", ");
}

/** What the panel's showcase is doing, always in view. */
function RunBadge({ status }: { status: RunStatus }) {
  const { server, busy } = status;
  const [state, text] = server
    ? server.ready
      ? (["done", `Running: ${server.customerId}`] as const)
      : (["pending", `Starting: ${server.customerId}`] as const)
    : busy
      ? (["pending", busy === "compose" ? "Composing…" : busy === "stop" ? "Stopping…" : "Starting…"] as const)
      : status.portInUse
        ? (["attention", `Port ${status.port} taken`] as const)
        : (["quiet", "Showcase not running"] as const);
  return (
    <div className="ms-auto flex items-center gap-2">
      {/* the quiet state is transparent, which would vanish on the chrome band */}
      <Status state={state} className={state === "quiet" ? "bg-surface" : undefined}>
        {text}
      </Status>
      {server?.ready ? (
        <a href={server.url} target="_blank" rel="noreferrer" className="text-sm font-medium underline">
          Open
        </a>
      ) : null}
    </div>
  );
}
