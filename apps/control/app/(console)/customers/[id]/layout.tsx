import { Meta, PageHeader } from "@his/ui";
import { FilePlus2 } from "lucide-react";
import type { ReactNode } from "react";
import { Code, LicenceStatus, LinkButton, Page } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { can, currentUser } from "@/lib/api";
import { formatDay, relativeDays } from "@/lib/format";
import { loadCustomer } from "@/lib/load";
import { CustomerTabs } from "./tabs";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: (await loadCustomer(id)).name.en };
}

export default async function CustomerLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, customer] = await Promise.all([currentUser(), loadCustomer(id)]);
  const s = customer.standing;

  return (
    <>
      <ConsoleTopbar crumbs={[{ href: "/customers", label: "Customers" }]} current={customer.name.en} />
      <Page>
        <PageHeader
          title={
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {customer.name.en}
              <bdi lang="ar" className="text-xl font-normal text-ink-3">
                {customer.name.ar}
              </bdi>
            </span>
          }
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <Code>{customer.id}</Code>
              <LicenceStatus display={s.state} />
              {s.endsOn ? (
                <Meta>
                  nearest end {formatDay(s.endsOn)} ({relativeDays(s.daysLeft ?? 0)})
                </Meta>
              ) : null}
              {customer.archivedAt ? <Meta>archived {formatDay(customer.archivedAt)}</Meta> : null}
            </span>
          }
          actions={
            can(user, "issuer") && !customer.archivedAt ? (
              <LinkButton href={`/licences/new?customer=${customer.id}`} tone="primary">
                <FilePlus2 aria-hidden />
                Issue licence
              </LinkButton>
            ) : null
          }
        />
        <CustomerTabs id={customer.id} installations={customer.installations} />
        {children}
      </Page>
    </>
  );
}
