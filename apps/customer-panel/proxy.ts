import { type NextRequest, NextResponse } from "next/server";

/*
 * The panel writes customer files and starts processes, so it only answers
 * when addressed as this machine. A page elsewhere that points its own
 * hostname at 127.0.0.1 (DNS rebinding) still sends that hostname as Host and
 * is refused here. Server Actions additionally reject an Origin that does not
 * match Host.
 */
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
  if (!LOCAL.has(hostname)) {
    return new NextResponse("The customer panel only answers on localhost.", { status: 403 });
  }
  return NextResponse.next();
}
