import { PageHeader, Panel, pill, SearchField } from "@his/ui";
import type { LicenceRow } from "@his/licence/api";
import { FileKey2, FilePlus2 } from "lucide-react";
import Link from "next/link";
import { EmptyState, LinkButton, Page } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { LicenceTable } from "@/components/licence-table";
import { can, currentUser, get } from "@/lib/api";

export const metadata = { title: "Licences" };

const FILTERS = [
  { key: "", label: "All", query: "" },
  { key: "active", label: "Active", query: "status=active" },
  { key: "warning", label: "Expiring", query: "display=warning" },
  { key: "grace", label: "In grace", query: "display=grace" },
  { key: "read-only", label: "Read-only", query: "display=read-only" },
  { key: "revoked", label: "Revoked", query: "display=revoked" },
  { key: "superseded", label: "Superseded", query: "display=superseded" },
] as const;

export default async function LicencesPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const { q = "", show = "" } = await searchParams;
  const filter = FILTERS.find((f) => f.key === show) ?? FILTERS[0];
  const query = [filter.query, q ? `q=${encodeURIComponent(q)}` : ""].filter(Boolean).join("&");
  const [user, licences] = await Promise.all([currentUser(), get<LicenceRow[]>(`/api/licences?${query}`)]);
  const href = (key: string) => {
    const params = new URLSearchParams();
    if (key) params.set("show", key);
    if (q) params.set("q", q);
    return `/licences${params.size ? `?${params}` : ""}`;
  };

  return (
    <>
      <ConsoleTopbar current="Licences" />
      <Page>
        <PageHeader
          title="Licences"
          subtitle="Every licence ever issued. An installation runs on its one active licence."
          actions={
            can(user, "issuer") ? (
              <LinkButton href="/licences/new" tone="primary">
                <FilePlus2 aria-hidden />
                Issue licence
              </LinkButton>
            ) : null
          }
        />
        <div className="mb-stack flex flex-wrap items-center gap-2">
          <form className="w-80 max-w-full" action="/licences">
            {filter.key ? <input type="hidden" name="show" value={filter.key} /> : null}
            <SearchField label="Search licences" name="q" defaultValue={q} placeholder="Customer, installation or licence id" />
          </form>
          <nav aria-label="Filter licences" className="flex flex-wrap gap-1.5 lg:ms-auto">
            {FILTERS.map((f) => (
              <Link key={f.key} href={href(f.key)} aria-pressed={f.key === filter.key} className={pill()}>
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
        <Panel>
          {licences.length ? (
            <LicenceTable licences={licences} />
          ) : (
            <EmptyState icon={FileKey2} title={q || filter.key ? "No licence matches" : "No licences issued yet"}>
              {q || filter.key ? "Clear the search or pick another filter." : "Add a customer and an installation, then issue its licence."}
            </EmptyState>
          )}
        </Panel>
      </Page>
    </>
  );
}
