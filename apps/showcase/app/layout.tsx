import { cn } from "@his/ui";
import { applyThemePolicy, htmlThemeProps, readPrefs, themeDefaults } from "@his/ui/theme";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ReviewBar } from "@/components/review-bar";
import { THEME_CHOICES, THEME_POLICY } from "@/lib/features";
import { getDict, getLang } from "@/lib/i18n";
import "./globals.css";
// import { almarai, plex, plexArabic, rubik } from "@/lib/fonts";


export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  // a first visit starts on the customer's default theme, not the design system's
  const saved = readPrefs((name) => store.get(name)?.value, themeDefaults(THEME_POLICY));
  // the customer's themes (set in the control app): a saved theme it does not have falls back to its default
  const prefs = applyThemePolicy(saved, THEME_POLICY);
  const lang = await getLang();
  const t = await getDict();
  const { className, ...themeAttrs } = htmlThemeProps(prefs, { policy: THEME_POLICY });

  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      // className={cn(plex.variable, plexArabic.variable, rubik.variable, almarai.variable, className)}
      // "dark" on the server-rendered <html>, so a saved dark mode is right on the first paint
      className={cn(className)}
      {...themeAttrs}
    >
      {/* overflow-hidden: only <main> scrolls, the shell never slides away */}
      <body className="flex h-dvh flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
        <ReviewBar prefs={prefs} lang={lang} t={t.review} themes={THEME_CHOICES.themes} pickBrand={THEME_CHOICES.pickBrand} />
        <div className="flex min-h-0 flex-1 print:block">{children}</div>
      </body>
    </html>
  );
}
