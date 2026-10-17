"use client";

import { Pill } from "@his/ui";
import { Funnel } from "lucide-react";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";

type FilterKey = keyof Dict["patients"]["filters"];

export function PatientFilters({ t }: { t: Dict["patients"] }) {
  const [active, setActive] = useState<FilterKey>("all");

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-pad py-pad-y">
      {(Object.keys(t.filters) as FilterKey[]).map((key) => (
        <Pill key={key} pressed={active === key} onClick={() => setActive(key)}>
          {t.filters[key]}
        </Pill>
      ))}
      <div className="ms-auto flex flex-wrap gap-2">
        <Pill>
          <Funnel aria-hidden />
          {t.clinic}
        </Pill>
        <Pill>{t.payer}</Pill>
        <Pill>{t.sort}</Pill>
      </div>
    </div>
  );
}
