import { Meta, Panel, PanelBody, PanelHeader } from "@his/ui";
import type { Installation, Release } from "@his/licence/api";
import { Server } from "lucide-react";
import { EmptyState } from "@/components/bits";
import { can, currentUser, get } from "@/lib/api";
import { loadCustomer } from "@/lib/load";
import { AddInstallation, InstallationCard } from "./installation-card";

export default async function CustomerInstallations({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, customer, installations, releases] = await Promise.all([
    currentUser(),
    loadCustomer(id),
    get<Installation[]>(`/api/customers/${encodeURIComponent(id)}/installations`),
    get<Release[]>(`/api/releases?customerId=${encodeURIComponent(id)}`),
  ]);
  const issuer = can(user, "issuer") && !customer.archivedAt;
  const live = installations.filter((i) => !i.retiredAt);
  const retired = installations.filter((i) => i.retiredAt);

  return (
    <div className="grid items-start gap-stack xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-stack">
        {live.length ? (
          live.map((i) => (
            <InstallationCard key={i.id} installation={i} issuer={issuer} releases={releases.filter((r) => r.installationId === i.id)} />
          ))
        ) : (
          <Panel>
            <EmptyState icon={Server} title="No installations yet">
              An installation is one place HIS runs for this customer — production, a test copy, a second site. Each gets its own
              licence.
            </EmptyState>
          </Panel>
        )}
        {retired.length ? (
          <Panel>
            <PanelHeader level="h2" title="Retired" meta={<Meta>{retired.length}</Meta>} />
            <div>
              {retired.map((i) => (
                <InstallationCard key={i.id} installation={i} issuer={false} flat />
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
      {issuer ? (
        <Panel className="xl:sticky xl:top-[calc(var(--topbar-h)+1rem)]">
          <PanelHeader level="h2" title="Add installation" />
          <PanelBody>
            <AddInstallation customerId={customer.id} />
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
