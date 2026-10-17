import {
  Almarai,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Arabic,
  Rubik,
} from "next/font/google";

// One family for both scripts — replaces the five fonts in HIS today.
// Which face draws Arabic is decided in globals.css by :lang(), not by the
// font stack order: next/font's generated Latin fallback (local Arial, no
// unicode-range) would otherwise claim every Arabic glyph, and Turbopack
// ignores adjustFontFallback: false.
export const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-ar",
  display: "swap",
});

// HIS today's fonts, for the "original" theme only — not preloaded
export const rubik = Rubik({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-rubik",
  preload: false,
});
export const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700", "800"],
  variable: "--font-almarai",
  preload: false,
});
