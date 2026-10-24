import { ListRow, Meta } from "@his/ui";
import type { AuditEntry } from "@his/licence/api";
import { History } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/bits";
import { ago, formatTime } from "@/lib/format";

const HREF: Partial<Record<AuditEntry["targetType"], (id: string) => string>> = {
  licence: (id) => `/licences/${id}`,
  customer: (id) => `/customers/${id}`,
  key: () => "/keys",
  catalog: () => "/catalog",
};

/** The audit trail as people read it: what, who, when. */
export function ActivityList({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <EmptyState icon={History} title="No activity yet" />;
  return (
    <div>
      {entries.map((e) => {
        const href = HREF[e.targetType]?.(e.targetId);
        return (
          <ListRow
            key={e.id}
            title={href ? <Link href={href} className="hover:underline">{e.summary}</Link> : e.summary}
            meta={
              <span title={formatTime(e.at)}>
                {e.actor} · {ago(e.at)}
              </span>
            }
            end={<Meta>{e.action}</Meta>}
          />
        );
      })}
    </div>
  );
}
