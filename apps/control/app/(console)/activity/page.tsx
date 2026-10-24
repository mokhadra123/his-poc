import { PageHeader, Panel, pill } from "@his/ui";
import type { AuditEntry } from "@his/licence/api";
import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { Page } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { get } from "@/lib/api";

export const metadata = { title: "Activity log" };

const FILTERS = [
  { key: "", label: "Everything" },
  { key: "licence", label: "Licences" },
  { key: "customer", label: "Customers" },
  { key: "installation", label: "Installations" },
  { key: "key", label: "Keys" },
  { key: "catalog", label: "Catalog" },
] as const;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type = "" } = await searchParams;
  const filter = FILTERS.find((f) => f.key === type) ?? FILTERS[0];
  const entries = await get<AuditEntry[]>(`/api/audit?limit=300${filter.key ? `&targetType=${filter.key}` : ""}`);
  return (
    <>
      <ConsoleTopbar current="Activity log" />
      <Page>
        <PageHeader title="Activity log" subtitle="Every change, who made it, and when. Nothing here can be edited." />
        <nav aria-label="Filter activity" className="mb-stack flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link key={f.key} href={f.key ? `/activity?type=${f.key}` : "/activity"} aria-pressed={f.key === filter.key} className={pill()}>
              {f.label}
            </Link>
          ))}
        </nav>
        <Panel>
          <ActivityList entries={entries} />
        </Panel>
      </Page>
    </>
  );
}
