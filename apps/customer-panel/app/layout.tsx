import { DEFAULT_PREFS, htmlThemeProps } from "@his/ui/theme";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Customer panel · HIS",
  description: "Configure HIS customers, their products and theme permission, and run their composed app locally.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // an internal tool: the design system's defaults, the system font
  const { className, ...themeAttrs } = htmlThemeProps(DEFAULT_PREFS);
  return (
    <html lang="en" dir="ltr" className={className} {...themeAttrs}>
      <body className="min-h-dvh bg-bg text-md text-ink">{children}</body>
    </html>
  );
}
