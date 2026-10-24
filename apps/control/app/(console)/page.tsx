import { ListRow, Meta, PageHeader, Panel, PanelHeader, Stat, Status } from "@his/ui";
import { dayOf } from "@his/licence";
import type { AttentionItem, Overview } from "@his/licence/api";
import { CircleCheck, FilePlus2, History, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState, LinkButton, Page } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { can, currentUser, get } from "@/lib/api";
import { ago, ATTENTION, formatDay } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const [user, overview] = await Promise.all([currentUser(), get<Overview>("/api/overview")]);
  const { counts, attention, recent } = overview;
  const issuer = can(user, "issuer");

  return (
    <>
      <ConsoleTopbar current="Overview" />
      <Page>
        <PageHeader
          title="Overview"
          subtitle={`Every customer's licences as of ${formatDay(dayOf(new Date()))}`}
          actions={
            issuer ? (
              <>
                <LinkButton href="/customers/new">
                  <Plus aria-hidden />
                  New customer
                </LinkButton>
                <LinkButton href="/licences/new" tone="primary">
                  <FilePlus2 aria-hidden />
                  Issue licence
                </LinkButton>
              </>
            ) : null
          }
        />

        <div className="mb-stack grid grid-cols-2 gap-stack md:grid-cols-4 xl:grid-cols-7">
          <Stat label="Customers" value={counts.customers} />
          <Stat label="Installations" value={counts.installations} />
          <Stat label="Active licences" value={counts.activeLicences} />
          <Stat label="Expiring" value={counts.expiringSoon} foot="within the warning period" />
          <Stat label="In grace" value={counts.inGrace} foot="ended, still working" />
          <Stat label="Read-only" value={counts.readOnly} foot="new records blocked" />
          <Stat label="Silent" value={counts.silent} foot="online, not reporting" />
        </div>

        <div className="grid items-start gap-stack xl:grid-cols-[3fr_2fr]">
          <Panel>
            <PanelHeader title="Needs attention" meta={<Meta>{attention.length}</Meta>} />
            {attention.length ? (
              <div>
                {attention.map((item) => (
                  <AttentionRow key={`${item.kind}-${item.installationId}`} item={item} issuer={issuer} />
                ))}
              </div>
            ) : (
              <EmptyState icon={CircleCheck} title="Nothing needs attention">
                Every installation has a current licence, and every online one is reporting.
              </EmptyState>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Recent activity"
              actions={
                <LinkButton href="/activity" size="sm" tone="ghost">
                  <History aria-hidden />
                  All activity
                </LinkButton>
              }
            />
            {recent.length ? (
              <div>
                {recent.map((entry) => (
                  <ListRow key={entry.id} title={entry.summary} meta={`${entry.actor} · ${ago(entry.at)}`} />
                ))}
              </div>
            ) : (
              <EmptyState icon={History} title="No activity yet" />
            )}
          </Panel>
        </div>
      </Page>
    </>
  );
}

function AttentionRow({ item, issuer }: { item: AttentionItem; issuer: boolean }) {
  const a = ATTENTION[item.kind];
  const renew = item.kind === "read-only" || item.kind === "grace" || item.kind === "expiring";
  const href = item.licenceId
    ? `/licences/new?installation=${item.installationId}&renew=${item.licenceId}`
    : `/licences/new?installation=${item.installationId}`;
  return (
    <ListRow
      title={
        <Link href={`/customers/${item.customerId}/installations`} className="hover:underline">
          {item.customerName.en} <span className="font-normal text-ink-3">· {item.installationLabel}</span>
        </Link>
      }
      meta={item.due ? `${item.detail} · ${formatDay(item.due)}` : item.detail}
      end={
        <>
          <Status state={a.state}>{a.label}</Status>
          {issuer && (renew || item.kind === "unlicensed") ? (
            <LinkButton href={href} size="sm">
              {renew ? "Renew" : "Issue"}
            </LinkButton>
          ) : item.licenceId ? (
            <LinkButton href={`/licences/${item.licenceId}`} size="sm" tone="ghost">
              View
            </LinkButton>
          ) : null}
        </>
      }
    />
  );
}
