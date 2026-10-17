"use client";

import { Pill } from "@his/ui";
import { useState } from "react";

/** searched for by scripts/verify-build.mjs — proves client code reached the browser bundle */
const BILLING_CLIENT_MARK = "his-billing-client-module";

const FILTERS = [
  { id: "all", label: { en: "All", ar: "الكل" } },
  { id: "unpaid", label: { en: "Unpaid", ar: "غير مدفوعة" } },
  { id: "claims", label: { en: "Claims", ar: "المطالبات" } },
] as const;

export function InvoiceFilters({ lang }: { lang: "en" | "ar" }) {
  const [active, setActive] = useState<(typeof FILTERS)[number]["id"]>("all");
  return (
    <div data-client-module={BILLING_CLIENT_MARK} className="flex flex-wrap gap-2 border-b border-line px-pad py-pad-y">
      {FILTERS.map((f) => (
        <Pill key={f.id} pressed={active === f.id} onClick={() => setActive(f.id)}>
          {f.label[lang]}
        </Pill>
      ))}
    </div>
  );
}
