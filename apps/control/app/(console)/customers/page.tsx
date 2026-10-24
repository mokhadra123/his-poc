import { NameCell, PageHeader, Panel, pill, SearchField, Table, Td, Th, Tr } from "@his/ui";
import type { Customer } from "@his/licence/api";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { Code, EmptyState, LicenceStatus, LinkButton, Page, ProductTags, ThemeSummary } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { can, currentUser, get } from "@/lib/api";
import { formatDay, relativeDays } from "@/lib/format";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const { q = "", archived } = await searchParams;
  const showArchived = archived === "1";
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (showArchived) params.set("archived", "1");
  const [user, customers] = await Promise.all([currentUser(), get<Customer[]>(`/api/customers?${params}`)]);

  return (
    <>
      <ConsoleTopbar current="Customers" />
      <Page>
        <PageHeader
          title="Customers"
          subtitle="Who runs HIS, where, and on which licence"
          actions={
            can(user, "issuer") ? (
              <LinkButton href="/customers/new" tone="primary">
                <Plus aria-hidden />
                New customer
              </LinkButton>
            ) : null
          }
        />

        <div className="mb-stack flex flex-wrap items-center gap-2">
          <form className="w-80 max-w-full" action="/customers">
            {showArchived ? <input type="hidden" name="archived" value="1" /> : null}
            <SearchField label="Search customers" name="q" defaultValue={q} placeholder="Name, id or contact" />
          </form>
          <nav aria-label="Which customers" className="ms-auto flex gap-1.5">
            <Link href={q ? `/customers?q=${encodeURIComponent(q)}` : "/customers"} aria-pressed={!showArchived} className={pill()}>
              Active
            </Link>
            <Link
              href={`/customers?archived=1${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-pressed={showArchived}
              className={pill()}
            >
              Archived
            </Link>
          </nav>
        </div>

        <Panel>
          {customers.length ? (
            <Table label="Customers">
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Licence</Th>
                  <Th>Nearest end</Th>
                  <Th>Installations</Th>
                  <Th>Products</Th>
                  <Th>Theme</Th>
                  <Th>Own code</Th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <Link href={`/customers/${c.id}`} className="hover:underline">
                        <NameCell primary={c.name.en} secondary={c.name.ar} secondaryLang="ar" />
                      </Link>
                      <div className="text-xs text-ink-3">
                        <Code className="text-xs text-ink-3">{c.id}</Code>
                      </div>
                    </Td>
                    <Td>
                      <LicenceStatus display={c.standing.state} />
                    </Td>
                    <Td tone="dim">
                      {c.standing.endsOn ? (
                        <>
                          {formatDay(c.standing.endsOn)}
                          <span className="block text-xs">{relativeDays(c.standing.daysLeft ?? 0)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>{c.installations}</Td>
                    <Td tone="wrap">
                      <ProductTags ids={c.products} empty={c.installations ? "Core only" : "—"} />
                    </Td>
                    <Td>
                      <Link href={`/customers/${c.id}/appearance`} className="hover:underline">
                        <ThemeSummary theme={c.theme} />
                      </Link>
                    </Td>
                    <Td tone="dim">{c.ownCode ? <Code className="text-xs">{c.ownCode.package}</Code> : "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={Building2}
              title={q ? `No customer matches “${q}”` : showArchived ? "No archived customers" : "No customers yet"}
              action={
                !q && !showArchived && can(user, "issuer") ? (
                  <LinkButton href="/customers/new" tone="primary">
                    <Plus aria-hidden />
                    New customer
                  </LinkButton>
                ) : null
              }
            >
              {q ? "Try a shorter search, or the customer's id." : null}
            </EmptyState>
          )}
        </Panel>
      </Page>
    </>
  );
}
