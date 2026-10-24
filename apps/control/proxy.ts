import { type NextRequest, NextResponse } from "next/server";

/*
 * The control plane signs licences, so in the POC it answers on this machine
 * only (DNS rebinding sends a foreign Host and is refused). In production it
 * sits behind the company VPN. Pages need a session cookie; whether it is
 * still valid is the licence server's call (a 401 sends the person back here).
 */
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);
const SESSION_COOKIE = "his-control-session";

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
  if (!LOCAL.has(hostname)) {
    return new NextResponse("The control plane only answers on localhost.", { status: 403 });
  }
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/login" && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|icon.svg).*)"],
};
