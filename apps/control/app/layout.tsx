import { htmlThemeProps, readPrefs } from "@his/ui/theme";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "HIS Control", template: "%s · HIS Control" },
  description: "Customers, installations and licences of HIS: issue, renew, revoke and watch them.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // an internal tool on the design system's default palette; mode, density and
  // navigation are each person's own (the same cookies as every HIS app)
  const store = await cookies();
  const prefs = readPrefs((name) => store.get(name)?.value);
  const { className, ...themeAttrs } = htmlThemeProps({ ...prefs, theme: "slate" });
  return (
    <html lang="en" dir="ltr" className={className} {...themeAttrs}>
      <body className="min-h-dvh bg-bg text-md text-ink">{children}</body>
    </html>
  );
}
