"use client";

import { Chip, Pill, Segmented, type SegmentedOption } from "@his/ui";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";

type Finding = "normal" | "abnormal" | "not-examined";

export function SegmentedDemo({ t }: { t: Dict["visit"]["exam"] }) {
  const [value, setValue] = useState<Finding>("abnormal");
  const options: SegmentedOption<Finding>[] = [
    { value: "normal", label: t.normal, weight: "confirm" },
    { value: "abnormal", label: t.abnormal, weight: "alarm" },
    { value: "not-examined", label: t.notExamined, weight: "quiet" },
  ];
  return <Segmented label={t.systems.cardio} options={options} value={value} onChange={setValue} />;
}

export function ChipDemo({ findings }: { findings: string[] }) {
  const [on, setOn] = useState<ReadonlySet<number>>(new Set([0]));
  return (
    <div className="flex flex-wrap gap-1.5">
      {findings.slice(0, 4).map((f, i) => (
        <Chip
          key={f}
          pressed={on.has(i)}
          onClick={() =>
            setOn((prev) => {
              const next = new Set(prev);
              if (next.has(i)) next.delete(i);
              else next.add(i);
              return next;
            })
          }
        >
          {f}
        </Chip>
      ))}
    </div>
  );
}

export function PillDemo({ labels }: { labels: string[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label, i) => (
        <Pill key={label} pressed={active === i} onClick={() => setActive(i)}>
          {label}
        </Pill>
      ))}
    </div>
  );
}
