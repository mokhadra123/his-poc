import { isPalettePref, PREF_COOKIES, parsePref, type Prefs } from "@his/ui/theme";
import { type NextRequest, NextResponse } from "next/server";
import { PALETTE_LOCKED } from "./lib/features";
import { LANG_COOKIE, LANGS, type Lang } from "./lib/lang";

/*
 * Shareable review links, like the restyle study's ?opt=a1:
 *   /visit?theme=pine&mode=dark&density=comfortable&lang=ar
 * Valid query values become cookies, invalid ones are dropped, then we
 * redirect to the clean URL (other query params are kept), so the server
 * renders the right <html> attributes on the very first paint.
 * A customer without the palette permission (lib/features.ts) gets the clean
 * URL for ?theme= and ?brand= too, but no cookie.
 */
const PREF_KEYS = Object.keys(PREF_COOKIES) as (keyof Prefs)[];

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const cookies: [string, string][] = [];
  let touched = false;
  console.log("url", url);

  for (const key of PREF_KEYS) {
    let raw = url.searchParams.get(key);
    console.log("raw", raw);
    if (raw === null) continue;
    touched = true;
    url.searchParams.delete(key);
    if (PALETTE_LOCKED && isPalettePref(key)) continue;
    if (key === "brand" && !raw.startsWith("#")) raw = `#${raw}`;
    const value = parsePref(key, raw);
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
