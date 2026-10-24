import { API_URL, sessionToken } from "@/lib/api";

/*
 * The release bundle — the one file delivered to the hospital. Streamed from
 * the licence server with the session token, so the browser never holds it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await sessionToken();
  if (!token) return new Response("Sign in first", { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/releases/${encodeURIComponent(id)}/bundle`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("The licence server is not answering", { status: 502 });
  }
  if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  return new Response(upstream.body, {
    headers: {
      "content-type": "application/gzip",
      "content-disposition": upstream.headers.get("content-disposition") ?? `attachment; filename="release-${id}.tar.gz"`,
      ...(upstream.headers.get("content-length") ? { "content-length": upstream.headers.get("content-length")! } : {}),
      "cache-control": "no-store",
    },
  });
}
