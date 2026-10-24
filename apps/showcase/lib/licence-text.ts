/*
 * Words and dates for the licence banner and page. Plain functions and
 * constants, so server and client components can both import them.
 */
import type { Dict } from "./i18n";
import type { Lang } from "./lang";

/** the banner's id: disabled actions point at it with aria-describedby */
export const LICENCE_NOTICE_ID = "licence-notice";

// Latin digits in Arabic too, as everywhere else in the app
const LOCALE: Record<Lang, string> = { en: "en-GB", ar: "ar-u-nu-latn" };

/** A YYYY-MM-DD day (UTC), e.g. "22 October 2026" / "22 أكتوبر 2026". */
export function formatDay(day: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** A moment, in the server's time zone, e.g. "22 October 2026, 14:05". */
export function formatMoment(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
}

/** "14 days" / "14 يومًا" — Arabic has six plural forms. */
export function countDays(n: number, forms: Dict["licence"]["days"], lang: Lang): string {
  const rule = new Intl.PluralRules(lang).select(n) as keyof typeof forms;
  return (forms[rule] ?? forms.other).replace("{n}", String(n));
}

/** Fill {name} placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** LRI…PDI: an id stays left-to-right inside an Arabic sentence. */
export const ltr = (text: string) => `⁦${text}⁩`;
