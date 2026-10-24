"use client";

import { cn } from "@his/ui";
import { DENSITIES, deriveBrand, MODES, type Prefs, setPref, type Theme } from "@his/ui/theme";
import { usePref } from "@his/ui/theme/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { LANG_COOKIE, type Lang } from "@/lib/lang";

/* The review bar is a tool for this POC, not part of the design. */

const PAGES = [
  { href: "/", key: "ds" },
  { href: "/dashboard", key: "dashboard" },
  { href: "/patients", key: "patients" },
  { href: "/visit", key: "visit" },
] as const;

export function ReviewBar({
  prefs,
  lang,
  t,
  themes,
  pickBrand,
}: {
  prefs: Prefs;
  lang: Lang;
  t: Dict["review"];
  /** the customer's themes users may switch between; none when it has one (see lib/features.ts) */
  themes: Theme[];
  /** the custom theme's colour is the user's to pick (the hospital has none of its own) */
  pickBrand: boolean;
}) {
  // <html> is the source of truth, so the pressed states never go stale
  const theme = usePref("theme", prefs.theme);
  const mode = usePref("mode", prefs.mode);
  const density = usePref("density", prefs.density);
  const [brand, setBrand] = useState(prefs.brand);
  const router = useRouter();
  const pathname = usePathname();
  const derived = deriveBrand(brand);
  const lowContrast = theme === "custom" && derived.inkContrast < 4.5;
  const nearCritical = theme === "custom" && derived.nearCritical;

  function switchLang(next: Lang) {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    router.refresh();
  }

  return (
    <div className="flex h-11 shrink-0 items-center gap-5 overflow-x-auto border-b border-line bg-ink px-4 text-sm text-surface [--focus:var(--surface)] dark:bg-input dark:text-ink-2 dark:[--focus:var(--ink)] print:hidden">
      <nav aria-label={t.page} className="flex items-center gap-1">
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            aria-current={pathname === p.href ? "page" : undefined}
            className={choiceClass}
          >
            {t.pages[p.key]}
          </Link>
        ))}
      </nav>

      {themes.length === 0 && !pickBrand ? null : (
        <>
          <Group label={t.theme}>
            {themes.map((th) => (
              <Choice key={th} pressed={theme === th} onClick={() => setPref("theme", th)}>
                {t.themes[th]}
              </Choice>
            ))}
            {theme === "custom" && pickBrand ? (
              <>
                <input
                  type="color"
                  aria-label={t.pickColour}
                  value={brand}
                  onChange={(e) => {
                    setBrand(e.target.value);
                    setPref("brand", e.target.value);
                  }}
                  className="ms-1 size-6 cursor-pointer rounded-ctl border border-surface/30 bg-transparent"
                />
                {lowContrast || nearCritical ? (
                  <span role="status" className="ms-1 whitespace-nowrap text-surface/80 dark:text-ink-2">
                    ⚠ {lowContrast ? t.lowContrast : t.nearCritical}
                  </span>
                ) : null}
              </>
            ) : null}
          </Group>

          {theme === "original" ? (
            <span role="status" className="whitespace-nowrap text-surface/80 dark:text-ink-2">
              ⓘ {t.originalNote}
            </span>
          ) : null}
        </>
      )}

      <Group label={t.mode}>
        {MODES.map((m) => (
          <Choice key={m} pressed={mode === m} onClick={() => setPref("mode", m)}>
            {t.modes[m]}
          </Choice>
        ))}
      </Group>

      <Group label={t.density}>
        {DENSITIES.map((d) => (
          <Choice key={d} pressed={density === d} onClick={() => setPref("density", d)}>
            {t.densities[d]}
          </Choice>
        ))}
      </Group>

      <Group label={t.language}>
        <Choice pressed={lang === "en"} onClick={() => switchLang("en")} lang="en">
          English
        </Choice>
        <Choice pressed={lang === "ar"} onClick={() => switchLang("ar")} lang="ar">
          عربي
        </Choice>
      </Group>
    </div>
  );
}

const choiceClass = cn(
  "cursor-pointer rounded-ctl px-2.5 py-1 whitespace-nowrap text-surface/75 hover:bg-surface/10 hover:text-surface",
  "aria-pressed:bg-surface/20 aria-pressed:text-surface aria-[current]:bg-surface/20 aria-[current]:text-surface",
  "dark:text-ink-3 dark:hover:bg-surface-2 dark:hover:text-ink",
  "dark:aria-pressed:bg-surface-2 dark:aria-pressed:text-ink dark:aria-[current]:bg-surface-2 dark:aria-[current]:text-ink",
);

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <span aria-hidden className="me-1 whitespace-nowrap text-surface/70 dark:text-ink-3 font-bold text-lg">
        {label}
      </span>
      {children}
    </div>
  );
}

function Choice({
  pressed,
  onClick,
  lang,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  lang?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" lang={lang} aria-pressed={pressed} onClick={onClick} className={choiceClass}>
      {children}
    </button>
  );
}
