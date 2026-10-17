/* Kept apart from i18n.ts so the proxy can import it without next/headers. */
export const LANGS = ["en", "ar"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_COOKIE = "his-lang";
