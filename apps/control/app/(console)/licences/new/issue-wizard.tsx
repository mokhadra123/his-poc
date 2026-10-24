"use client";

import { ActionBar, Button, cn, Meta, Panel, PanelBody, PanelHeader, Segmented, Step, Steps } from "@his/ui";
import { addDays, dayOf, evaluateLicence } from "@his/licence";
import type { Customer, Installation, LicenceDetail, Product } from "@his/licence/api";
import { ArrowLeft, ArrowRight, FileSignature, LoaderCircle, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState, useTransition } from "react";
import { type ActionResult, issueLicence } from "@/app/actions";
import { Code, Details, LicenceStatus, ProductTags } from "@/components/bits";
import { Notice, SelectField, TextArea, TextField } from "@/components/fields";
import { LicenceTimeline } from "@/components/timeline";
import { formatDay, relativeDays } from "@/lib/format";

type Term = "1y" | "2y" | "3y" | "custom";
const STEPS = ["Installation", "Products", "Term", "Review and sign"] as const;

/** n years after `day`, kept on the day before the anniversary (a licence from 1 Jan runs to 31 Dec) */
function yearsAfter(day: string, years: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return addDays(dayOf(d), -1);
}

export function IssueWizard({
  customers,
  installations,
  catalog,
  preset,
  renewing,
}: {
  customers: Customer[];
  installations: Installation[];
  catalog: Product[];
  preset: { customerId: string | null; installationId: string | null };
  renewing: LicenceDetail | null;
}) {
  const today = dayOf(new Date());
  const [step, setStep] = useState(preset.installationId ? 1 : 0);
  const [customerId, setCustomerId] = useState(preset.customerId ?? "");
  const [installationId, setInstallationId] = useState(preset.installationId ?? "");
  const [products, setProducts] = useState<string[]>(renewing?.products ?? []);
  const [term, setTerm] = useState<Term>("1y");
  const [customEnd, setCustomEnd] = useState("");
  const [warnDays, setWarnDays] = useState(renewing?.warnDays ?? 30);
  const [graceDays, setGraceDays] = useState(renewing?.graceDays ?? 14);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ActionResult>(null);
  const [signing, startSigning] = useTransition();

  const customerInstallations = installations.filter((i) => i.customerId === customerId);
  const installation = installations.find((i) => i.id === installationId) ?? null;
  const current = installation?.licence ?? null;
  // a renewal continues from the current end, so no paid day is lost
  const startFrom = current && current.expiresOn >= today ? addDays(current.expiresOn, 1) : today;
  const expiresOn = term === "custom" ? customEnd : yearsAfter(startFrom, Number(term[0]));
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(expiresOn) && expiresOn >= today;
  const preview = useMemo(
    () => (validDate ? evaluateLicence({ issuedAt: new Date().toISOString(), expiresOn, warnDays, graceDays }) : null),
    [validDate, expiresOn, warnDays, graceDays],
  );

  const added = current ? products.filter((p) => !current.products.includes(p)) : [];
  const removed = current ? current.products.filter((p) => !products.includes(p)) : [];
  const ready = [Boolean(installation), true, validDate && warnDays >= 0 && graceDays >= 0, true];
  const canReach = (index: number) => ready.slice(0, index).every(Boolean);

  function sign() {
    if (!installation || !validDate) return;
    startSigning(async () => {
      setResult(await issueLicence({ installationId: installation.id, products, expiresOn, warnDays, graceDays, note: note.trim() || null }));
    });
  }

  const toggle = (id: string) => setProducts(products.includes(id) ? products.filter((p) => p !== id) : [...products, id]);

  return (
    <div className="grid items-start gap-stack lg:grid-cols-[15rem_minmax(0,1fr)]">
      <Panel className="lg:sticky lg:top-[calc(var(--topbar-h)+1rem)]">
        <PanelBody>
          <Steps aria-label="Issue a licence">
            {STEPS.map((label, index) =>
              index < step ? (
                <Step key={label} index={index + 1} state="done" doneLabel="done" onClick={() => setStep(index)}>
                  {label}
                </Step>
              ) : (
                <Step
                  key={label}
                  index={index + 1}
                  state={index === step ? "current" : "todo"}
                  disabled={!canReach(index)}
                  onClick={() => setStep(index)}
                >
                  {label}
                </Step>
              ),
            )}
          </Steps>
        </PanelBody>
      </Panel>

      <div className="flex min-w-0 flex-col gap-stack">
        {step === 0 ? (
          <Panel>
            <PanelHeader level="h2" title="Which installation?" />
            <PanelBody className="flex flex-col gap-4">
              <SelectField
                label="Customer"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setInstallationId("");
                }}
                className="max-w-md"
              >
                <option value="">Choose a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name.en} ({c.id})
                  </option>
                ))}
              </SelectField>
              {customerId ? (
                customerInstallations.length ? (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-medium text-ink-2">Installation</legend>
                    {customerInstallations.map((i) => (
                      <label
                        key={i.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-ctl border border-line bg-surface p-3 hover:bg-surface-2",
                          "has-checked:border-accent-text has-checked:bg-accent-soft",
                          "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
                        )}
                      >
                        <input
                          type="radio"
                          name="installation"
                          className="mt-1 size-4 shrink-0 accent-accent outline-none"
                          checked={installationId === i.id}
                          onChange={() => {
                            setInstallationId(i.id);
                            setProducts(i.licence?.products ?? []);
                          }}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{i.label}</span>
                            <Meta>{i.environment}</Meta>
                            <Meta>{i.connectivity}</Meta>
                            {i.licence ? <LicenceStatus display={i.licence.display} /> : <LicenceStatus display="unlicensed" />}
                          </span>
                          <span className="text-xs text-ink-3">
                            {i.licence
                              ? `Current licence until ${formatDay(i.licence.expiresOn)} · ${i.licence.products.join(", ") || "core only"}`
                              : "No active licence"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <Notice title="This customer has no installation yet">
                    <Link href={`/customers/${customerId}/installations`} className="font-medium text-accent-text underline">
                      Add one
                    </Link>{" "}
                    first — a licence always belongs to one installation.
                  </Notice>
                )
              ) : null}
            </PanelBody>
          </Panel>
        ) : null}

        {step === 1 ? (
          <Panel>
            <PanelHeader level="h2" title="Which products?" meta={<Meta>{products.length ? `${products.length} of ${catalog.length}` : "core only"}</Meta>} />
            <PanelBody className="flex flex-col gap-3">
              <p className="text-sm text-ink-3">
                Core (patients, visits, appointments, billing basics, settings, the general clinic) is in every build. Tick what was
                sold on top. A product only reaches the hospital in a build composed from this licence.
              </p>
              <ul className="grid gap-2 md:grid-cols-2">
                {catalog.map((p) => {
                  const on = products.includes(p.id);
                  const change = current ? (on && !current.products.includes(p.id) ? "added" : !on && current.products.includes(p.id) ? "removed" : null) : null;
                  return (
                    <li key={p.id}>
                      <label
                        className={cn(
                          "flex h-full cursor-pointer gap-3 rounded-ctl border border-line bg-surface p-3 hover:bg-surface-2",
                          "has-checked:border-accent-text has-checked:bg-accent-soft",
                          "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
                        )}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="mt-0.5 size-4 shrink-0 accent-accent outline-none" />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {p.name.en}
                            <bdi lang="ar" className="font-normal text-ink-3">
                              {p.name.ar}
                            </bdi>
                            {change ? <Meta>{change === "added" ? "added" : "removed"}</Meta> : null}
                          </span>
                          <span className="text-xs text-ink-3">
                            <Code className="text-xs">{p.id}</Code> · {p.routes.map((r) => `/${r}`).join(", ") || "no pages"}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {removed.length ? (
                <Notice tone="problem" title={`Removing ${removed.join(", ")}`}>
                  The installation keeps the code until it gets a new build, but those pages close as soon as this licence is
                  installed.
                </Notice>
              ) : null}
            </PanelBody>
          </Panel>
        ) : null}

        {step === 2 ? (
          <Panel>
            <PanelHeader level="h2" title="For how long?" />
            <PanelBody className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-ink-2">Term</span>
                <Segmented
                  label="Term"
                  value={term}
                  onChange={setTerm}
                  options={[
                    { value: "1y", label: "1 year" },
                    { value: "2y", label: "2 years" },
                    { value: "3y", label: "3 years" },
                    { value: "custom", label: "Pick a date" },
                  ]}
                  className="self-start"
                />
                <p className="text-xs text-ink-3">
                  {current && current.expiresOn >= today
                    ? `Counted from the day after the current licence ends (${formatDay(current.expiresOn)}), so no paid day is lost.`
                    : "Counted from today."}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="Last valid day"
                  type="date"
                  min={today}
                  value={expiresOn}
                  readOnly={term !== "custom"}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  error={term === "custom" && customEnd && !validDate ? "Pick today or a later day" : undefined}
                  hint={validDate ? relativeDays(Math.round((Date.parse(expiresOn) - Date.parse(today)) / 86_400_000)) : undefined}
                />
                <TextField
                  label="Warning (days before)"
                  type="number"
                  min={0}
                  max={180}
                  value={warnDays}
                  onChange={(e) => setWarnDays(Math.max(0, Math.min(180, Number(e.target.value) || 0)))}
                  hint="The hospital sees a banner"
                />
                <TextField
                  label="Grace (days after)"
                  type="number"
                  min={0}
                  max={90}
                  value={graceDays}
                  onChange={(e) => setGraceDays(Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
                  hint="Still fully working, then read-only"
                />
              </div>
              {preview ? (
                <div className="rounded-ctl border border-line p-4">
                  <LicenceTimeline evaluation={preview} issuedAt={new Date().toISOString()} />
                </div>
              ) : null}
            </PanelBody>
          </Panel>
        ) : null}

        {step === 3 && installation ? (
          <Panel>
            <PanelHeader level="h2" title="Check and sign" />
            <PanelBody className="flex flex-col gap-5">
              <Details
                items={[
                  ["Customer", installation.customerName.en],
                  ["Installation", `${installation.label} (${installation.environment}, ${installation.connectivity})`],
                  ["Products", <ProductTags key="p" ids={products} />],
                  ...(current
                    ? ([
                        [
                          "Change",
                          added.length || removed.length ? (
                            <span key="c" className="flex flex-wrap gap-3">
                              {added.length ? (
                                <span className="inline-flex items-center gap-1">
                                  <Plus aria-hidden className="size-3.5" />
                                  {added.join(", ")}
                                </span>
                              ) : null}
                              {removed.length ? (
                                <span className="inline-flex items-center gap-1 font-semibold">
                                  <Minus aria-hidden className="size-3.5" />
                                  {removed.join(", ")}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            "Same products as now"
                          ),
                        ],
                      ] as [string, ReactNode][])
                    : []),
                  ["Last valid day", `${formatDay(expiresOn)} (${relativeDays(preview?.daysLeft ?? 0)})`],
                  ["Warning / grace", `${warnDays} days before / ${graceDays} days after`],
                  ...(current ? ([["Replaces", `${current.id.slice(0, 8)} (until ${formatDay(current.expiresOn)})`]] as [string, string][]) : []),
                ]}
              />
              <TextArea
                label="Note (optional)"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                hint="Order number, who asked for it — kept with the licence"
              />
              <Notice title={installation.connectivity === "online" ? "Delivered by heartbeat" : "Delivered by hand"}>
                {installation.connectivity === "online"
                  ? "The installation installs it by itself at its next heartbeat. Products added still need a new build."
                  : "You download the file next; the hospital's administrator uploads it on HIS → Licence."}
              </Notice>
              {result && !result.ok ? (
                <Notice tone="problem" title={result.error}>
                  {Object.values(result.fields).length ? (
                    <ul className="list-disc ps-5">
                      {Object.entries(result.fields).map(([field, message]) => (
                        <li key={field}>{message}</li>
                      ))}
                    </ul>
                  ) : null}
                </Notice>
              ) : null}
            </PanelBody>
          </Panel>
        ) : null}

        <ActionBar>
          {step > 0 ? (
            <Button tone="ghost" onClick={() => setStep(step - 1)} disabled={signing}>
              <ArrowLeft aria-hidden className="rtl:-scale-x-100" />
              Back
            </Button>
          ) : (
            <Link href="/licences" className="text-sm text-ink-3 hover:text-ink hover:underline">
              Cancel
            </Link>
          )}
          <span className="truncate text-sm text-ink-3">
            Step {step + 1} of {STEPS.length}
            {installation ? ` · ${installation.customerName.en} · ${installation.label}` : ""}
          </span>
          {step < STEPS.length - 1 ? (
            <Button tone="primary" data-primary disabled={!ready[step]} onClick={() => setStep(step + 1)}>
              Continue
              <ArrowRight aria-hidden className="rtl:-scale-x-100" />
            </Button>
          ) : (
            <Button tone="primary" data-primary disabled={signing || !ready.every(Boolean)} onClick={sign}>
              {signing ? <LoaderCircle aria-hidden className="animate-spin" /> : <FileSignature aria-hidden />}
              {signing ? "Signing…" : current ? "Renew and sign" : "Issue and sign"}
            </Button>
          )}
        </ActionBar>
      </div>
    </div>
  );
}
