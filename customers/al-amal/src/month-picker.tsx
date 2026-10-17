"use client";

import { Pill } from "@his/ui";
import { useState } from "react";

/** searched for by scripts/verify-build.mjs — proves Al-Amal's client code reached the browser bundle */
const AL_AMAL_CLIENT_MARK = "his-al-amal-client-module";

const MONTHS = [
  { id: "2026-08", label: { en: "August", ar: "أغسطس" } },
  { id: "2026-09", label: { en: "September", ar: "سبتمبر" } },
  { id: "2026-10", label: { en: "October", ar: "أكتوبر" } },
] as const;

export function MonthPicker({ lang }: { lang: "en" | "ar" }) {
  const [month, setMonth] = useState<(typeof MONTHS)[number]["id"]>("2026-09");
  return (
    <div data-client-module={AL_AMAL_CLIENT_MARK} className="flex flex-wrap gap-2 border-b border-line px-pad py-pad-y">
      {MONTHS.map((m) => (
        <Pill key={m.id} pressed={month === m.id} onClick={() => setMonth(m.id)}>
          {m.label[lang]}
        </Pill>
      ))}
    </div>
  );
}
