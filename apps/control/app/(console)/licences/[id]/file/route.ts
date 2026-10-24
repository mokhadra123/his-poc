import { API_URL, sessionToken } from "@/lib/api";

/*
 * The licence file as the hospital receives it. Streamed from the licence
 * server with the session token, so the browser downloads it without ever
 * holding the token.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await sessionToken();
  if (!token) return new Response("Sign in first", { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/licences/${encodeURIComponent(id)}/file`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("The licence server is not answering", { status: 502 });
  }
  if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  return new Response(upstream.body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": upstream.headers.get("content-disposition") ?? `attachment; filename="licence-${id}.json"`,
      "cache-control": "no-store",
    },
  });
}
