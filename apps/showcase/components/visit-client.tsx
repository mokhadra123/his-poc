"use client";

import { Button, Chip, Meta, Panel, PanelBody, PanelHeader, Segmented, type SegmentedOption } from "@his/ui";
import { type RailState, setPref } from "@his/ui/theme";
import { usePref } from "@his/ui/theme/client";
import { Bone, Brain, CircleDot, Heart, PanelRightClose, PanelRightOpen, Square, User, Wind, Zap } from "lucide-react";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";

export function RailToggle({
  initial,
  controls,
  label,
}: {
  initial: RailState;
  /** id of the side panel */
  controls: string;
  /** a static name; aria-expanded announces the state, the icon shows it */
  label: string;
}) {
  // read from <html>, so back/forward never leaves the state stale
  const open = usePref("rail", initial) === "open";
  const Icon = open ? PanelRightClose : PanelRightOpen;

  return (
    <Button
      size="sm"
      aria-expanded={open}
      aria-controls={controls}
      onClick={() => setPref("rail", open ? "collapsed" : "open")}
      className="max-xl:hidden"
    >
      <Icon aria-hidden className="rtl:-scale-x-100" />
      {label}
    </Button>
  );
}

type Finding = "normal" | "abnormal" | "not-examined";
type Screening = "phq9" | "gad7" | "not-done";

const SYSTEMS = [
  { key: "general", icon: User },
  { key: "cardio", icon: Heart },
  { key: "resp", icon: Wind },
  { key: "abdomen", icon: CircleDot },
  { key: "neuro", icon: Zap },
  { key: "msk", icon: Bone },
  { key: "skin", icon: Square },
] as const;

type SystemKey = (typeof SYSTEMS)[number]["key"];

export function ExamPanel({ t }: { t: Dict["visit"]["exam"] }) {
  const [values, setValues] = useState<Record<SystemKey, Finding>>({
    general: "normal",
    cardio: "abnormal",
    resp: "normal",
    abdomen: "not-examined",
    neuro: "not-examined",
    msk: "not-examined",
    skin: "normal",
  });
  const [screening, setScreening] = useState<Screening>("not-done");
  const [findings, setFindings] = useState<ReadonlySet<number>>(new Set([0, 1]));

  const findingOptions: SegmentedOption<Finding>[] = [
    { value: "normal", label: t.normal, weight: "confirm" },
    { value: "abnormal", label: t.abnormal, weight: "alarm" },
    { value: "not-examined", label: t.notExamined, weight: "quiet" },
  ];
  // choosing a screening tool is not a clinical result, so no confirm colour
  const screeningOptions: SegmentedOption<Screening>[] = [
    { value: "phq9", label: "PHQ-9", weight: "select" },
    { value: "gad7", label: "GAD-7", weight: "select" },
    { value: "not-done", label: t.notDone, weight: "quiet" },
  ];

  const all = Object.values(values);
  const done = all.filter((v) => v !== "not-examined").length + (screening === "not-done" ? 0 : 1);
  const abnormal = all.filter((v) => v === "abnormal").length;
  const summary = t.summary
    .replace("{done}", String(done))
    .replace("{total}", String(SYSTEMS.length + 1))
    .replace("{abnormal}", String(abnormal));

  function markRestNormal() {
    setValues((v) => {
      const next = { ...v };
      for (const key of Object.keys(next) as SystemKey[]) {
        if (next[key] === "not-examined") next[key] = "normal";
      }
      return next;
    });
  }

  function toggleFinding(i: number) {
    setFindings((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const rowClass = "rounded-card border border-line";
  const headClass = "flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5";
  const iconClass = "size-4.5 shrink-0 stroke-[1.7] text-ink-3";

  return (
    <Panel>
      <PanelHeader
        title={t.title}
        meta={<Meta aria-live="polite">{summary}</Meta>}
        actions={
          <Button size="sm" onClick={markRestNormal}>
            {t.markRest}
          </Button>
        }
        className="flex-wrap"
      />
      <PanelBody className="flex flex-col gap-2">
        {SYSTEMS.map(({ key, icon: Icon }) => (
          <div key={key} className={rowClass}>
            <div className={headClass}>
              <Icon aria-hidden className={iconClass} />
              <span className="text-md font-medium">{t.systems[key]}</span>
              <Segmented
                className="ms-auto"
                label={t.systems[key]}
                options={findingOptions}
                value={values[key]}
                onChange={(v) => setValues((s) => ({ ...s, [key]: v }))}
              />
            </div>
            {key === "cardio" && values.cardio === "abnormal" ? (
              <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
                {t.findings.map((f, i) => (
                  <Chip key={f} pressed={findings.has(i)} onClick={() => toggleFinding(i)}>
                    {f}
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        <div className={rowClass}>
          <div className={headClass}>
            <Brain aria-hidden className={iconClass} />
            <span className="text-md font-medium">{t.systems.screening}</span>
            <Segmented
              className="ms-auto"
              label={t.systems.screening}
              options={screeningOptions}
              value={screening}
              onChange={setScreening}
            />
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
