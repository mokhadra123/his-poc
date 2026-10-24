import {
  ActionBar,
  Button,
  Meta,
  Panel,
  PanelBody,
  PanelHeader,
  PatientBanner,
  Step,
  Steps,
  Tab,
  Tabs,
  Vital,
  Vitals,
} from "@his/ui";
import { readPrefs } from "@his/ui/theme";
import { cookies } from "next/headers";
import { ReadOnlyNote, WriteButton } from "@/components/licence-client";
import { MarkChip, Page, PageTopbar } from "@/components/page-parts";
import { Slot } from "@/components/slot";
import { ExamPanel, RailToggle } from "@/components/visit-client";
import { pick, visit } from "@/lib/data";
import { getDict, getLang } from "@/lib/i18n";

export default async function VisitPage() {
  const store = await cookies();
  const prefs = readPrefs((name) => store.get(name)?.value);
  const lang = await getLang();
  const t = await getDict();
  const v = t.visit;

  return (
    <>
      <PageTopbar crumbs={[v.crumb]} current={v.current} t={t.shell} />
      <Page>
        <PatientBanner
          nameAs="h1"
          initials={pick(visit.initials, lang)}
          name={pick(visit.name, lang)}
          altName={pick(visit.altName, lang)}
          altNameLang={lang === "ar" ? "en" : "ar"}
          meta={v.meta}
          alerts={visit.alerts.map((m) => (
            <MarkChip key={m.label.en} mark={m} lang={lang} />
          ))}
          facts={[
            { label: v.facts.payer, value: pick(visit.payer, lang) },
            { label: v.facts.arrived, value: visit.arrived },
            { label: v.facts.seenBy, value: pick(visit.seenBy, lang) },
          ]}
        />

        <Tabs
          aria-label={v.sectionsLabel}
          end={<RailToggle initial={prefs.rail} controls="visit-rail" label={v.sidePanel} />}
        >
          {v.tabs.map((tab, i) => (
            <Tab key={tab} href={`#section-${i + 1}`} current={i === 1}>
              {tab}
            </Tab>
          ))}
        </Tabs>

        {/* rail-collapsed is scoped to xl: below it the toggle is hidden, so the panel must always show */}
        <div className="grid grid-cols-[228px_minmax(0,1fr)_300px] items-start gap-stack max-xl:grid-cols-[210px_minmax(0,1fr)] max-lg:grid-cols-1 xl:rail-collapsed:grid-cols-[228px_minmax(0,1fr)]">
          <Steps aria-label={v.stepsLabel}>
            {v.steps.map((step, i) =>
              i === 0 ? (
                <Step key={step} index={1} state="done" doneLabel={v.stepDone}>
                  {step}
                </Step>
              ) : (
                <Step key={step} index={i + 1} state={i === 1 ? "current" : "todo"}>
                  {step}
                </Step>
              ),
            )}
          </Steps>

          <section>
            <ExamPanel t={v.exam} />
            <ActionBar>
              <ReadOnlyNote note={t.licence.readOnlyNote} className="min-w-0 truncate text-sm text-ink-3">
                {v.saved}
              </ReadOnlyNote>
              <WriteButton>{v.saveDraft}</WriteButton>
              <WriteButton tone="primary" data-primary>
                {v.saveNext}
              </WriteButton>
            </ActionBar>
          </section>

          <aside
            id="visit-rail"
            aria-label={v.sidePanel}
            className="flex flex-col gap-stack max-xl:col-span-full max-xl:grid max-xl:grid-cols-3 max-lg:grid-cols-1 xl:rail-collapsed:hidden"
          >
            <Panel>
              <PanelHeader title={v.vitals} meta={<Meta>08:22</Meta>} />
              <Vitals>
                <Vital label={v.vitalLabels.bp} value="158/94" />
                <Vital label={v.vitalLabels.pulse} value="96" unit={v.units.bpm} />
                <Vital label={v.vitalLabels.temp} value="37.1" unit="°C" />
                <Vital label={v.vitalLabels.spo2} value="93" unit="%" flagged flaggedLabel={v.outOfRange} />
                <Vital label={v.vitalLabels.weight} value="78" unit={v.units.kg} />
                <Vital label={v.vitalLabels.bmi} value="28.6" />
              </Vitals>
            </Panel>

            <Panel>
              <PanelHeader title={v.allergies} />
              <PanelBody className="flex flex-col items-start gap-2">
                {visit.allergies.map((m) => (
                  <MarkChip key={m.label.en} mark={m} lang={lang} />
                ))}
                <p className="mt-1 text-sm text-ink-3">{v.reviewed}</p>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader title={v.medications} actions={<WriteButton size="sm">{v.add}</WriteButton>} />
              <PanelBody className="py-1">
                {visit.medications.map((m) => (
                  <div key={m.name.en} className="border-b border-line-2 py-2.5 last:border-b-0">
                    <div className="text-md font-medium">{pick(m.name, lang)}</div>
                    <div className="mt-0.5 text-xs text-ink-3">{pick(m.dose, lang)}</div>
                  </div>
                ))}
              </PanelBody>
            </Panel>

            {/* outlet: a customer's own panel goes here (packages/slots) */}
            <Slot name="visit.side-panel" props={{ patientId: visit.mrn, visitId: visit.visitNo, lang }} />
          </aside>
        </div>
      </Page>
    </>
  );
}
