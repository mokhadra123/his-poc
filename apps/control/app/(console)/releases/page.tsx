import { NameCell, PageHeader, Panel, Status, Table, Td, Th, Tr } from "@his/ui";
import type { Release } from "@his/licence/api";
import { Hammer } from "lucide-react";
import Link from "next/link";
import { Code, EmptyState, Page, ProductTags } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { get } from "@/lib/api";
import { formatBytes, formatTime, RELEASE } from "@/lib/format";

export const metadata = { title: "Releases" };

export default async function ReleasesPage() {
  const releases = await get<Release[]>("/api/releases");
  return (
    <>
      <ConsoleTopbar current="Releases" />
      <Page>
        <PageHeader
          title="Releases"
          subtitle="Each installation's HIS, built from its licence: the image and the one bundle file the hospital installs."
        />
        <Panel>
          {releases.length ? (
            <Table label="Releases">
              <thead>
                <tr>
                  <Th>Version</Th>
                  <Th>Customer</Th>
                  <Th>Installation</Th>
                  <Th>Status</Th>
                  <Th>Products</Th>
                  <Th>Bundle</Th>
                  <Th>Started</Th>
                </tr>
              </thead>
              <tbody>
                {releases.map((r) => {
                  const s = RELEASE[r.status];
                  return (
                    <Tr key={r.id}>
                      <Td>
                        <Link href={`/releases/${r.id}`} className="hover:underline">
                          <Code className="text-sm text-ink">{r.version ?? r.id.slice(0, 8)}</Code>
                        </Link>
                      </Td>
                      <Td>
                        <NameCell primary={r.customerName.en} secondary={r.customerName.ar} secondaryLang="ar" />
                      </Td>
                      <Td tone="dim">
                        {r.installationLabel} · {r.connectivity}
                      </Td>
                      <Td>
                        <Status state={s.state} title={r.status === "running" ? (r.step ?? undefined) : (r.error ?? undefined)}>
                          {s.label}
                        </Status>
                      </Td>
                      <Td tone="wrap">
                        <ProductTags ids={r.products} />
                      </Td>
                      <Td tone="dim">{r.status === "succeeded" ? formatBytes(r.bytes) : "—"}</Td>
                      <Td tone="dim">
                        {formatTime(r.createdAt)}
                        <span className="block text-xs">by {r.requestedBy}</span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={Hammer} title="No releases yet">
              Build one from an installation that has a licence: Customers, then the customer, then Installations, then Build release.
            </EmptyState>
          )}
        </Panel>
      </Page>
    </>
  );
}
