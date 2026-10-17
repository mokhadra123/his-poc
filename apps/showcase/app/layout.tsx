import { cn } from "@his/ui";
import { htmlThemeProps, readPrefs } from "@his/ui/theme";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ReviewBar } from "@/components/review-bar";
import { getDict, getLang } from "@/lib/i18n";
import "./globals.css";
import { almarai, plex, plexArabic, rubik } from "@/lib/fonts";


export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const prefs = readPrefs((name) => store.get(name)?.value);
  const lang = await getLang();
  const t = await getDict();
  const { className, ...themeAttrs } = htmlThemeProps(prefs);

  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={cn(plex.variable, plexArabic.variable, rubik.variable, almarai.variable, className)}
      {...themeAttrs}
    >
      {/* overflow-hidden: only <main> scrolls, the shell never slides away */}
      <body className="flex h-dvh flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
        <ReviewBar prefs={prefs} lang={lang} t={t.review} />
        <div className="flex min-h-0 flex-1 print:block">{children}</div>
      </body>
    </html>
  );
}
