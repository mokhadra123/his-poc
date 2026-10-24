"use client";

import { ActionBar, Button, cn, Meta, Panel, PanelBody, PanelHeader } from "@his/ui";
import { deriveBrand, THEMES, type Theme } from "@his/ui/theme";
import type { CustomerTheme } from "@his/licence/api";
import { RotateCcw, Save } from "lucide-react";
import { type CSSProperties, useState, useTransition } from "react";
import { type ActionResult, setCustomerTheme } from "@/app/actions";
import { ActionMessage, Notice } from "@/components/fields";

const LABEL: Record<Theme, { name: string; help: string }> = {
  slate: { name: "Slate", help: "Calm blue band — the design system's default" },
  ink: { name: "Ink", help: "No brand colour; the accent is the ink" },
  pine: { name: "Pine", help: "Sage ground, green accent" },
  graphite: { name: "Graphite", help: "Dark rail beside a bright workspace" },
  custom: { name: "Hospital colour", help: "Built from one colour of the hospital's choice" },
  original: { name: "HIS today", help: "The current HIS look, for a customer used to it" },
};

const HEX = /^#[0-9a-f]{6}$/i;

/** The custom theme's colours for a preview, measured as the app measures them (deriveBrand) */
function brandStyle(brand: string): CSSProperties {
  const d = deriveBrand(brand);
  return {
    "--brand-custom": brand,
    "--brand-custom-ink": d.ink,
    "--brand-custom-ink-dim": d.inkDim,
    "--brand-custom-text": d.text,
    "--brand-custom-hover-toward": d.hoverToward,
    "--brand-custom-field-line": d.fieldLine,
    "--brand-custom-edge": d.edge,
  } as CSSProperties;
}

/**
 * A thumbnail of the app in one theme: the top band, the rail, a line of text
 * and a primary button. data-theme on the element is enough — every theme's
 * tokens are scoped to [data-theme], so it follows light/dark like the app.
 */
function ThemePreview({ theme, brand }: { theme: Theme; brand: string | null }) {
  return (
    <div
      aria-hidden
      data-theme={theme}
      style={theme === "custom" && brand ? brandStyle(brand) : undefined}
      className="flex h-20 flex-col overflow-hidden rounded-ctl border border-line bg-bg"
    >
      <div className="flex h-4 shrink-0 items-center gap-1 border-b border-chrome-line bg-chrome px-1.5">
        <span className="size-2 rounded-full bg-mark" />
        <span className="h-1 w-8 rounded-full bg-chrome-ink-dim" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-7 shrink-0 flex-col gap-1 border-e border-nav-line bg-nav p-1">
          <span className="h-1.5 rounded-full bg-nav-active" />
          <span className="h-1 rounded-full bg-nav-ink-dim" />
          <span className="h-1 rounded-full bg-nav-ink-dim" />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 bg-bg p-1.5">
          <span className="h-1.5 w-3/4 rounded-full bg-ink-3" />
          <span className="h-1 w-1/2 rounded-full bg-line" />
          <span className="mt-auto h-3 w-10 rounded-ctl bg-accent" />
        </div>
      </div>
    </div>
  );
}

/** What the hospital's users will see, in one sentence */
function summary(t: CustomerTheme) {
  const name = (theme: string) => LABEL[theme as Theme]?.name ?? theme;
  const others = t.allowed.filter((x) => x !== t.default).map(name);
  const start = others.length
    ? `Users start on ${name(t.default)} and may switch to ${others.join(", ")}.`
    : `Everyone sees ${name(t.default)}; there is no theme switch.`;
  if (!t.allowed.includes("custom")) return start;
  return `${start} ${t.brand ? `The hospital colour is ${t.brand}.` : "Users pick the hospital colour themselves."}`;
}

export function ThemeEditor({ customerId, theme, readOnly }: { customerId: string; theme: CustomerTheme; readOnly: boolean }) {
  const [allowed, setAllowed] = useState<string[]>(theme.allowed);
  const [fallback, setFallback] = useState(theme.default);
  const [ownColour, setOwnColour] = useState(theme.brand !== null);
  const [brand, setBrand] = useState(theme.brand ?? "#1f6f8b");
  const [result, setResult] = useState<ActionResult>(null);
  const [saving, startSaving] = useTransition();

  // keep @his/ui's order, and a default that is one of the allowed themes
  const ordered = THEMES.filter((t) => allowed.includes(t));
  const effectiveDefault = ordered.includes(fallback as Theme) ? fallback : (ordered[0] ?? "slate");
  const hasCustom = ordered.includes("custom");
  const brandOk = !hasCustom || !ownColour || HEX.test(brand);
  const draft: CustomerTheme = {
    default: effectiveDefault,
    allowed: ordered,
    brand: hasCustom && ownColour ? brand.toLowerCase() : null,
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(theme);
  const lowContrast = hasCustom && ownColour && HEX.test(brand) && deriveBrand(brand).inkContrast < 4.5;
  const nearCritical = hasCustom && ownColour && HEX.test(brand) && deriveBrand(brand).nearCritical;

  function toggle(t: Theme) {
    setResult(null);
    if (allowed.includes(t)) {
      if (allowed.length === 1) return; // a customer always has at least one theme
      setAllowed(allowed.filter((x) => x !== t));
    } else {
      setAllowed([...allowed, t]);
    }
  }

  function reset() {
    setAllowed(theme.allowed);
    setFallback(theme.default);
    setOwnColour(theme.brand !== null);
    setBrand(theme.brand ?? "#1f6f8b");
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-stack">
      <Panel>
        <PanelHeader
          level="h2"
          title="Themes"
          meta={<Meta>{ordered.length === 1 ? "fixed" : `${ordered.length} to choose from`}</Meta>}
        />
        <PanelBody className="flex flex-col gap-4">
          <p className="text-sm text-ink-3">
            Tick the themes this customer&apos;s users may use and pick the one they start on. One theme gives everyone the same
            look, with no theme switch. Light/dark mode and density stay each user&apos;s own choice.
          </p>
          <fieldset disabled={readOnly} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <legend className="sr-only">Allowed themes</legend>
            {THEMES.map((t) => {
              const on = allowed.includes(t);
              const isDefault = on && effectiveDefault === t;
              return (
                <div
                  key={t}
                  className={cn(
                    "flex flex-col gap-2.5 rounded-card border bg-surface p-3",
                    on ? "border-accent-text" : "border-line",
                    readOnly && "opacity-90",
                  )}
                >
                  <ThemePreview theme={t} brand={ownColour && HEX.test(brand) ? brand : null} />
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(t)}
                      aria-describedby={`theme-${t}-help`}
                      className="mt-0.5 size-4 shrink-0 accent-accent"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium text-ink">{LABEL[t].name}</span>
                      <span id={`theme-${t}-help`} className="text-xs text-ink-3">
                        {LABEL[t].help}
                      </span>
                    </span>
                  </label>
                  <label className={cn("flex items-center gap-2 text-sm", on ? "cursor-pointer text-ink-2" : "text-ink-3")}>
                    <input
                      type="radio"
                      name="default-theme"
                      checked={isDefault}
                      disabled={!on}
                      onChange={() => setFallback(t)}
                      className="size-4 accent-accent"
                    />
                    {isDefault ? <span className="font-semibold text-ink">Default — users start here</span> : "Make default"}
                  </label>
                </div>
              );
            })}
          </fieldset>
        </PanelBody>
      </Panel>

      {hasCustom ? (
        <Panel>
          <PanelHeader level="h2" title="Hospital colour" />
          <PanelBody className="flex flex-col gap-3">
            <fieldset disabled={readOnly} className="flex flex-col gap-2">
              <legend className="sr-only">Who picks the colour of the custom theme</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="brand-mode" checked={ownColour} onChange={() => setOwnColour(true)} className="size-4 accent-accent" />
                The hospital&apos;s colour, the same for everyone
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="brand-mode" checked={!ownColour} onChange={() => setOwnColour(false)} className="size-4 accent-accent" />
                Each user picks a colour
              </label>
            </fieldset>
            {ownColour ? (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  aria-label="Hospital colour"
                  value={HEX.test(brand) ? brand : "#000000"}
                  disabled={readOnly}
                  onChange={(e) => setBrand(e.target.value)}
                  className="h-control w-14 cursor-pointer rounded-ctl border border-control-line bg-input p-1"
                />
                <input
                  aria-label="Hospital colour, hex"
                  value={brand}
                  readOnly={readOnly}
                  onChange={(e) => setBrand(e.target.value.trim())}
                  spellCheck={false}
                  aria-invalid={!HEX.test(brand) || undefined}
                  className="h-control w-32 rounded-ctl border border-control-line bg-input px-3 font-mono text-md text-ink aria-[invalid=true]:border-2 aria-[invalid=true]:border-ink"
                />
                {!HEX.test(brand) ? <span className="text-xs font-semibold text-ink">A colour like #1f6f8b</span> : null}
              </div>
            ) : null}
            {lowContrast || nearCritical ? (
              <Notice tone="problem" title={lowContrast ? "Text on this colour is hard to read" : "This colour is close to the clinical red"}>
                {lowContrast
                  ? "The app keeps every text readable, but the band will look washed out. A deeper shade works better."
                  : "Red means critical in HIS; a brand that looks like it blurs that signal. Pick another hue."}
              </Notice>
            ) : null}
          </PanelBody>
        </Panel>
      ) : null}

      <Notice title={summary(draft)}>
        Saved to <code className="font-mono">customers/{customerId}/customer.json</code>; it applies from this customer&apos;s next build.
      </Notice>
      <ActionMessage result={result} />

      {readOnly ? null : (
        <ActionBar>
          <Button tone="ghost" onClick={reset} disabled={!dirty || saving}>
            <RotateCcw aria-hidden />
            Revert
          </Button>
          <span role="status" className="truncate text-sm text-ink-3">
            {dirty ? "Unsaved changes" : "No changes"}
          </span>
          <Button
            tone="primary"
            data-primary
            disabled={!dirty || !brandOk || saving}
            onClick={() => startSaving(async () => setResult(await setCustomerTheme(customerId, draft)))}
          >
            <Save aria-hidden />
            {saving ? "Saving…" : "Save themes"}
          </Button>
        </ActionBar>
      )}
    </div>
  );
}
