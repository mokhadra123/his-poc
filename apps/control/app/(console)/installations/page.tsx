import { NameCell, PageHeader, Panel, Status, Table, Td, Th, Tr } from "@his/ui";
import type { Installation } from "@his/licence/api";
import { Server } from "lucide-react";
import Link from "next/link";
import { Code, EmptyState, LicenceStatus, Page } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { get } from "@/lib/api";
import { ago, formatDay, formatTime } from "@/lib/format";

export const metadata = { title: "Installations" };

export default async function InstallationsPage() {
  const installations = (await get<Installation[]>("/api/installations")).filter((i) => !i.retiredAt);
  const silentBefore = Date.now() - 3 * 86_400_000;

  return (
    <>
      <ConsoleTopbar current="Installations" />
      <Page>
        <PageHeader title="Installations" subtitle="Every place HIS runs, its licence, and when it last reported in" />
        <Panel>
          {installations.length ? (
            <Table label="Installations">
              <thead>
                <tr>
                  <Th>Installation</Th>
                  <Th>Customer</Th>
                  <Th>Where</Th>
                  <Th>Licence</Th>
                  <Th>Last heartbeat</Th>
                  <Th>Version</Th>
                  <Th>Copies</Th>
                </tr>
              </thead>
              <tbody>
                {installations.map((i) => {
                  const hb = i.lastHeartbeat;
                  const silent = i.connectivity === "online" && (!hb || Date.parse(hb.at) < silentBefore);
                  return (
                    <Tr key={i.id}>
                      <Td>
                        <Link href={`/customers/${i.customerId}/installations`} className="font-medium hover:underline">
                          {i.label}
                        </Link>
                        <div>
                          <Code className="text-xs text-ink-3">{i.id.slice(0, 8)}</Code>
                        </div>
                      </Td>
                      <Td>
                        <NameCell primary={i.customerName.en} secondary={i.customerName.ar} secondaryLang="ar" />
                      </Td>
                      <Td tone="dim">
                        {i.environment} · {i.connectivity}
                      </Td>
                      <Td>
                        {i.licence ? (
                          <Link href={`/licences/${i.licence.id}`} className="flex flex-col items-start gap-0.5">
                            <LicenceStatus display={i.licence.display} />
                            <span className="text-xs text-ink-3">until {formatDay(i.licence.expiresOn)}</span>
                          </Link>
                        ) : (
                          <LicenceStatus display="unlicensed" />
                        )}
                      </Td>
                      <Td tone="dim">
                        {i.connectivity === "offline" ? (
                          "offline"
                        ) : silent ? (
                          <Status state="pending" title={hb ? formatTime(hb.at) : undefined}>
                            {hb ? `silent · ${ago(hb.at)}` : "never reported"}
                          </Status>
                        ) : (
                          <span title={formatTime(hb!.at)}>{ago(hb!.at)}</span>
                        )}
                      </Td>
                      <Td tone="dim">{hb?.version ?? "—"}</Td>
                      <Td>{i.instances > 1 ? <Status state="attention">{i.instances} copies</Status> : i.instances || "—"}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={Server} title="No installations yet">
              Installations are added on a customer&apos;s page.
            </EmptyState>
          )}
        </Panel>
      </Page>
    </>
  );
}
