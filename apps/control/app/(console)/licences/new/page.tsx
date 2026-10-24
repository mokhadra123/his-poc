import { PageHeader } from "@his/ui";
import type { Customer, Installation, LicenceDetail, Product } from "@his/licence/api";
import { redirect } from "next/navigation";
import { Page } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { can, currentUser, get } from "@/lib/api";
import { loadLicence } from "@/lib/load";
import { IssueWizard } from "./issue-wizard";

export const metadata = { title: "Issue licence" };

export default async function IssueLicencePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; installation?: string; renew?: string }>;
}) {
  const { customer, installation, renew } = await searchParams;
  const user = await currentUser();
  if (!can(user, "issuer")) redirect("/licences");

  const [customers, installations, catalog, renewing] = await Promise.all([
    get<Customer[]>("/api/customers"),
    get<Installation[]>("/api/installations"),
    get<Product[]>("/api/catalog"),
    renew ? loadLicence(renew) : Promise.resolve<LicenceDetail | null>(null),
  ]);
  const live = installations.filter((i) => !i.retiredAt);
  const presetInstallation = live.find((i) => i.id === (renewing?.installationId ?? installation)) ?? null;
  const presetCustomer = presetInstallation?.customerId ?? customers.find((c) => c.id === customer)?.id ?? null;

  return (
    <>
      <ConsoleTopbar crumbs={[{ href: "/licences", label: "Licences" }]} current={renewing ? "Renew licence" : "Issue licence"} />
      <Page>
        <PageHeader
          title={renewing ? `Renew licence — ${renewing.customerName.en}` : "Issue a licence"}
          subtitle={
            renewing
              ? `${renewing.installationLabel}: the new licence replaces the current one the moment it is signed`
              : "For one installation of one customer. It is signed when you confirm, and replaces any active one."
          }
        />
        <IssueWizard
          customers={customers}
          installations={live}
          catalog={catalog.filter((p) => !p.retired)}
          preset={{ customerId: presetCustomer, installationId: presetInstallation?.id ?? null }}
          renewing={renewing}
        />
      </Page>
    </>
  );
}
