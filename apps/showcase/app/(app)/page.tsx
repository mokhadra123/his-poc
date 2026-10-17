import {
  Button,
  cn,
  NameCell,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Pill,
  SearchField,
  Signal,
  Stat,
  Status,
  Step,
  Steps,
  Tab,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
  Vital,
  Vitals,
} from "@his/ui";
import { type Theme, THEMES } from "@his/ui/theme";
import { Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { ChipDemo, PillDemo, SegmentedDemo } from "@/components/ds-demos";
import { HIS_COMMIT, HisToday } from "@/components/his-today";
import { Page, PageTopbar } from "@/components/page-parts";
import { pick } from "@/lib/data";
import { getDict, getLang, type L } from "@/lib/i18n";

/* Class names are written out in full so Tailwind can find them. */
const TOKENS: { cls: string; name: string }[] = [
  { cls: "bg-bg", name: "bg" },
  { cls: "bg-surface", name: "surface" },
  { cls: "bg-surface-2", name: "surface-2" },
  { cls: "bg-line", name: "line" },
  { cls: "bg-ink", name: "ink" },
  { cls: "bg-ink-2", name: "ink-2" },
  { cls: "bg-ink-3", name: "ink-3" },
  { cls: "bg-accent", name: "accent" },
  { cls: "bg-accent-soft", name: "accent-soft" },
  { cls: "bg-accent-line", name: "accent-line" },
  { cls: "bg-accent-text", name: "accent-text" },
  { cls: "bg-chrome", name: "chrome" },
  { cls: "bg-nav", name: "nav" },
  { cls: "bg-nav-active", name: "nav-active" },
  { cls: "bg-critical", name: "critical" },
  { cls: "bg-critical-soft", name: "critical-soft" },
  { cls: "bg-caution", name: "caution" },
  { cls: "bg-caution-soft", name: "caution-soft" },
  { cls: "bg-stable", name: "stable" },
  { cls: "bg-stable-soft", name: "stable-soft" },
  { cls: "bg-info", name: "info" },
  { cls: "bg-info-soft", name: "info-soft" },
];

const CLINICAL: { tone: "critical" | "caution" | "stable" | "info"; label: L }[] = [
  { tone: "critical", label: { en: "Penicillin — anaphylaxis", ar: "البنسلين — صدمة تحسسية" } },
  { tone: "critical", label: { en: "Potassium 6.8", ar: "البوتاسيوم 6.8" } },
  { tone: "caution", label: { en: "eGFR 48", ar: "eGFR 48" } },
  { tone: "stable", label: { en: "Vitals in range", ar: "العلامات ضمن المعدل" } },
  { tone: "info", label: { en: "Pregnant, 28 weeks", ar: "حامل، 28 أسبوعًا" } },
];

const OPERATIONAL: { state: "attention" | "pending" | "done" | "quiet"; label: L }[] = [
  { state: "attention", label: { en: "Outstanding balance", ar: "رصيد مستحق" } },
  { state: "attention", label: { en: "Pre-auth rejected", ar: "رُفض التفويض المسبق" } },
  { state: "pending", label: { en: "Waiting 27m", ar: "ينتظر 27 د" } },
  { state: "done", label: { en: "Confirmed", ar: "مؤكد" } },
  { state: "quiet", label: { en: "Checked in", ar: "تم تسجيل الوصول" } },
];

export default async function DesignSystemPage() {
  const lang = await getLang();
  const t = await getDict();
  const ds = t.ds;

  return (
    <>
      <PageTopbar crumbs={[t.shell.system]} current={ds.title} t={t.shell} />
      <Page>
        <PageHeader title={ds.title} subtitle={ds.subtitle} />

        <Section title={ds.principlesTitle}>
          <div className="grid gap-stack md:grid-cols-2 2xl:grid-cols-4">
            {ds.principles.map(([title, body], i) => (
              <Panel key={title}>
                <PanelBody>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid size-5 place-items-center rounded-full bg-surface-2 text-2xs font-semibold text-ink-2">
                      {i + 1}
                    </span>
                    <h3 className="text-lg font-semibold">{title}</h3>
                  </div>
                  <p className="text-sm text-ink-2">{body}</p>
                </PanelBody>
              </Panel>
            ))}
          </div>
        </Section>

        <Section title={ds.themesTitle} note={ds.themesNote}>
          <div className="grid gap-stack sm:grid-cols-2 xl:grid-cols-3">
            {THEMES.map((theme) => (
              <ThemePreview
                key={theme}
                theme={theme}
                name={t.review.themes[theme]}
                sample={ds.sample}
                critical={pick(CLINICAL[0].label, lang)}
                criticalTone={t.tones.critical}
              />
            ))}
          </div>
        </Section>

        <Section title={ds.signalsTitle}>
          <div className="grid gap-stack md:grid-cols-2">
            <Panel>
              <PanelHeader level="h3" title={ds.clinical} />
              <PanelBody className="flex flex-wrap gap-2">
                {CLINICAL.map((c) => (
                  <Signal key={c.label.en} tone={c.tone} toneLabel={t.tones[c.tone]}>
                    {pick(c.label, lang)}
                  </Signal>
                ))}
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader level="h3" title={ds.operational} />
              <PanelBody className="flex flex-wrap gap-2">
                {OPERATIONAL.map((o) => (
                  <Status key={o.label.en} state={o.state}>
                    {pick(o.label, lang)}
                  </Status>
                ))}
              </PanelBody>
            </Panel>
          </div>
        </Section>

        <Section title={ds.componentsTitle}>
          <div className="grid items-start gap-stack md:grid-cols-2 xl:grid-cols-3">
            <Demo title="Button">
              <div className="flex flex-wrap items-center gap-2">
                <Button tone="primary">{ds.sample.primary}</Button>
                <Button>{ds.sample.neutral}</Button>
                <Button tone="ghost">{ds.sample.ghost}</Button>
                <Button size="sm">
                  <Plus aria-hidden />
                  {ds.sample.small}
                </Button>
                <Button iconOnly aria-label={t.shell.search}>
                  <Search aria-hidden />
                </Button>
              </div>
            </Demo>

            <Demo title="Pill · Chip">
              <div className="flex flex-col gap-3">
                <PillDemo labels={[ds.sample.filter, t.patients.filters.admitted, t.patients.filters.missing]} />
                <ChipDemo findings={t.visit.exam.findings} />
              </div>
            </Demo>

            <Demo title="Segmented">
              <SegmentedDemo t={t.visit.exam} />
            </Demo>

            <Demo title="Tabs · Steps">
              <Tabs aria-label={ds.componentsTitle} className="mb-3">
                <Tab href="#overview" current>
                  {ds.sample.tab1}
                </Tab>
                <Tab href="#history">{ds.sample.tab2}</Tab>
              </Tabs>
              <Steps aria-label={t.visit.stepsLabel}>
                <Step index={1} state="done" doneLabel={t.visit.stepDone}>
                  {t.visit.steps[0]}
                </Step>
                <Step index={2} state="current">
                  {t.visit.steps[1]}
                </Step>
                <Step index={3}>{t.visit.steps[2]}</Step>
              </Steps>
            </Demo>

            <Demo title="SearchField · Stat">
              <div className="flex flex-col gap-3">
                <SearchField label={t.shell.search} placeholder={t.shell.search} landmark={false} />
                <Stat label={t.dashboard.stats.visits[0]} value="148" foot={t.dashboard.stats.visits[1]} trend="up" />
              </div>
            </Demo>

            <Demo title="Vitals" flush>
              <Vitals>
                <Vital label={t.visit.vitalLabels.bp} value="158/94" />
                <Vital label={t.visit.vitalLabels.pulse} value="96" unit={t.visit.units.bpm} />
                <Vital label={t.visit.vitalLabels.spo2} value="93" unit="%" flagged flaggedLabel={t.visit.outOfRange} />
              </Vitals>
            </Demo>

            <Demo title="Table" flush className="md:col-span-2 xl:col-span-3">
              <Table label={ds.componentsTitle}>
                <thead>
                  <tr>
                    <Th>{t.patients.cols.mrn}</Th>
                    <Th>{t.patients.cols.name}</Th>
                    <Th>{t.patients.cols.clinic}</Th>
                    <Th>{t.patients.cols.status}</Th>
                  </tr>
                </thead>
                <tbody>
                  <Tr>
                    <Td tone="id">40921</Td>
                    <Td>
                      <NameCell
                        primary={lang === "ar" ? "ليلى منصور" : "Layla Mansour"}
                        secondary={lang === "ar" ? "Layla Mansour" : "ليلى منصور"}
                        secondaryLang={lang === "ar" ? "en" : "ar"}
                      />
                    </Td>
                    <Td tone="dim">{lang === "ar" ? "الباطنة" : "Internal medicine"}</Td>
                    <Td>
                      <Signal tone="critical" toneLabel={t.tones.critical}>
                        {pick(CLINICAL[0].label, lang)}
                      </Signal>
                    </Td>
                  </Tr>
                  <Tr>
                    <Td tone="id">31204</Td>
                    <Td>
                      <NameCell
                        primary={lang === "ar" ? "عبدالله ناصر" : "Abdullah Nasser"}
                        secondary={lang === "ar" ? "Abdullah Nasser" : "عبدالله ناصر"}
                        secondaryLang={lang === "ar" ? "en" : "ar"}
                      />
                    </Td>
                    <Td tone="dim">{lang === "ar" ? "الباطنة" : "Internal medicine"}</Td>
                    <Td>
                      <Status state="attention">{pick(OPERATIONAL[0].label, lang)}</Status>
                    </Td>
                  </Tr>
                </tbody>
              </Table>
            </Demo>
          </div>
        </Section>

        <Section id="his-today" title={ds.his.title} note={ds.his.note.replace("{commit}", HIS_COMMIT)}>
          <HisToday t={ds.his} lang={lang} />
        </Section>

        <Section title={ds.tokensTitle} note={ds.tokensNote}>
          <Panel>
            <PanelBody className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {TOKENS.map((token) => (
                <div key={token.name} className="flex items-center gap-2.5">
                  <span className={cn("size-8 shrink-0 rounded-ctl border border-line", token.cls)} />
                  <code className="text-xs text-ink-2">{token.name}</code>
                </div>
              ))}
            </PanelBody>
          </Panel>
        </Section>
      </Page>
    </>
  );
}

function Section({ id, title, note, children }: { id?: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-8 scroll-mt-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {note ? <p className="mt-1 text-sm text-ink-3">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Demo({
  title,
  flush,
  className,
  children,
}: {
  title: string;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Panel className={className}>
      <PanelHeader level="h3" title={<code className="text-md">{title}</code>} />
      <PanelBody flush={flush}>{children}</PanelBody>
    </Panel>
  );
}

/**
 * The same markup inside a different data-theme — the tokens do the rest.
 * The "current" outline and the custom colour are pure CSS (see globals.css
 * and --brand-custom on <html>), so they follow client-side switches live.
 */
function ThemePreview({
  theme,
  name,
  sample,
  critical,
  criticalTone,
}: {
  theme: Theme;
  name: string;
  sample: { primary: string; filter: string };
  critical: string;
  criticalTone: string;
}) {
  return (
    <div data-theme={theme} data-preview={theme} className="overflow-hidden rounded-card border border-line bg-bg">
      <div className="flex h-10 items-center gap-2 border-b border-chrome-line bg-chrome px-3 text-md font-semibold text-chrome-ink">
        <span aria-hidden className="grid size-5 place-items-center rounded-ctl bg-mark text-2xs font-bold text-mark-ink">
          M
        </span>
        {name}
      </div>
      <div className="flex min-h-36">
        <div aria-hidden className="flex w-14 shrink-0 flex-col gap-1.5 border-e border-nav-line bg-nav bg-(image:--nav-image) p-2">
          <span className="h-2 rounded-full bg-nav-ink-dim/40" />
          <span className="relative h-5 rounded-ctl bg-nav-active before:absolute before:inset-y-1 before:inset-s-0 before:w-0.5 before:rounded-full before:bg-nav-marker" />
          <span className="h-2 rounded-full bg-nav-ink-dim/40" />
          <span className="h-2 rounded-full bg-nav-ink-dim/40" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            <Button tone="primary" size="sm">
              {sample.primary}
            </Button>
            <Pill pressed>{sample.filter}</Pill>
          </div>
          <Signal tone="critical" toneLabel={criticalTone} className="h-auto max-w-full py-0.5 whitespace-normal">
            {critical}
          </Signal>
          <div aria-hidden className="mt-auto flex gap-1">
            {["bg-accent", "bg-accent-soft", "bg-accent-line", "bg-surface-2"].map((cls) => (
              <span key={cls} className={cn("size-5 rounded-ctl border border-line", cls)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
