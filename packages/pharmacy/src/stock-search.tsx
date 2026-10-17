"use client";

import { SearchField } from "@his/ui";
import { useState } from "react";

/** searched for by scripts/verify-build.mjs — proves client code reached the browser bundle */
const PHARMACY_CLIENT_MARK = "his-pharmacy-client-module";

export function StockSearch({ lang }: { lang: "en" | "ar" }) {
  const [q, setQ] = useState("");
  const label = lang === "ar" ? "ابحث في الأصناف" : "Search items";
  return (
    <div data-client-module={PHARMACY_CLIENT_MARK} className="border-b border-line px-pad py-pad-y">
      <SearchField
        label={label}
        placeholder={label}
        landmark={false}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-80"
      />
    </div>
  );
}
