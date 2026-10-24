import { PREF_COOKIES, parsePref, type Prefs, type Theme } from "@his/ui/theme";
import { type NextRequest, NextResponse } from "next/server";
import { THEME_CHOICES } from "./lib/features";
import { LANG_COOKIE, LANGS, type Lang } from "./lib/lang";

/*
 * Shareable review links, like the restyle study's ?opt=a1:
 *   /visit?theme=pine&mode=dark&density=comfortable&lang=ar
 * Valid query values become cookies, invalid ones are dropped, then we
 * redirect to the clean URL (other query params are kept), so the server
 * renders the right <html> attributes on the very first paint.
 * A theme the customer does not have (lib/features.ts) gets the clean URL
 * but no cookie; so does ?brand= when the hospital has its own colour.
 */
const PREF_KEYS = Object.keys(PREF_COOKIES) as (keyof Prefs)[];

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const cookies: [string, string][] = [];
  let touched = false;

  for (const key of PREF_KEYS) {
    let raw = url.searchParams.get(key);
    if (raw === null) continue;
    touched = true;
    url.searchParams.delete(key);
    // the customer's themes only, and a colour of one's own only when the hospital has none
    if (key === "brand" && !THEME_CHOICES.pickBrand) continue;
    if (key === "brand" && !raw.startsWith("#")) raw = `#${raw}`;
    const value = parsePref(key, raw);
    if (key === "theme" && !THEME_CHOICES.themes.includes(value as Theme)) continue;
    if (value !== undefined) cookies.push([PREF_COOKIES[key], value]);
  }

  const lang = url.searchParams.get("lang");
  if (lang !== null) {
    touched = true;
    url.searchParams.delete("lang");
    if (LANGS.includes(lang as Lang)) cookies.push([LANG_COOKIE, lang]);
  }

  if (!touched) return NextResponse.next();

  const response = NextResponse.redirect(url);
  for (const [name, value] of cookies) {
    response.cookies.set(name, value, { path: "/", maxAge: 31536000, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
