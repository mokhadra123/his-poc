import { getRunner } from "@/lib/server/runner";

/* Polled by the run panel. Read-only: every change goes through a Server Action. */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getRunner().status(), { headers: { "cache-control": "no-store" } });
}
