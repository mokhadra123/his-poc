import { Panel } from "@his/ui";
import type { AuditEntry } from "@his/licence/api";
import { ActivityList } from "@/components/activity-list";
import { get } from "@/lib/api";

export default async function CustomerActivity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entries = await get<AuditEntry[]>(`/api/audit?customerId=${encodeURIComponent(id)}&limit=200`);
  return (
    <Panel>
      <ActivityList entries={entries} />
    </Panel>
  );
}
