import { cn } from "@his/ui";
import { htmlThemeProps, lockPalette, readPrefs } from "@his/ui/theme";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ReviewBar } from "@/components/review-bar";
import { PALETTE_LOCKED } from "@/lib/features";
import { getDict, getLang } from "@/lib/i18n";
import "./globals.css";
// import { almarai, plex, plexArabic, rubik } from "@/lib/fonts";


export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const saved = readPrefs((name) => store.get(name)?.value);
  // a customer without the palette permission keeps the default palette, whatever was saved
  const prefs = PALETTE_LOCKED ? lockPalette(saved) : saved;
  const lang = await getLang();
  const t = await getDict();
  const { className, ...themeAttrs } = htmlThemeProps(prefs, { paletteLocked: PALETTE_LOCKED });

  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      // className={cn(plex.variable, plexArabic.variable, rubik.variable, almarai.variable, className)}
      {...themeAttrs}
    >
      {/* overflow-hidden: only <main> scrolls, the shell never slides away */}
      <body className="flex h-dvh flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
        <ReviewBar prefs={prefs} lang={lang} t={t.review} paletteLocked={PALETTE_LOCKED} />
        <div className="flex min-h-0 flex-1 print:block">{children}</div>
      </body>
    </html>
  );
}
