import { API_URL, sessionToken } from "@/lib/api";

/* The release as JSON, for the release page's live view while it builds. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await sessionToken();
  if (!token) return Response.json({ error: "Sign in first" }, { status: 401 });
  try {
    const upstream = await fetch(`${API_URL}/api/releases/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ error: "The licence server is not answering" }, { status: 502 });
  }
}
