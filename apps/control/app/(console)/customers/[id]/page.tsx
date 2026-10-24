import { Panel, PanelBody, PanelHeader } from "@his/ui";
import type { Product } from "@his/licence/api";
import { Code, Details, ProductTags } from "@/components/bits";
import { Notice } from "@/components/fields";
import { can, currentUser, get } from "@/lib/api";
import { formatDay } from "@/lib/format";
import { loadCustomer } from "@/lib/load";
import { CustomerForm } from "../customer-form";
import { ArchiveCustomer } from "./archive";

export default async function CustomerOverview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const [user, customer, catalog] = await Promise.all([currentUser(), loadCustomer(id), get<Product[]>("/api/catalog")]);
  const issuer = can(user, "issuer");
  const names = new Map(catalog.map((p) => [p.id, p.name.en]));

  return (
    <div className="grid items-start gap-stack xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-stack">
        {created ? (
          <Notice tone="done" title={`${customer.name.en} was created`}>
            Next: add the installation(s) where it runs, then issue each a licence. Its build folder is{" "}
            <Code>customers/{customer.id}</Code>.
          </Notice>
        ) : null}
        <CustomerForm customer={customer} readOnly={!issuer || Boolean(customer.archivedAt)} />
      </div>

      <div className="flex min-w-0 flex-col gap-stack">
        <Panel>
          <PanelHeader level="h2" title="What they run" />
          <PanelBody className="flex flex-col gap-3 text-sm">
            <p className="text-ink-3">Products on the customer&apos;s active licences. Core is always included.</p>
            <ProductTags ids={customer.products} empty={customer.installations ? "Core only" : "No active licence"} />
            {customer.products.length ? (
              <ul className="flex flex-col gap-1 text-ink-2">
                {customer.products.map((p) => (
                  <li key={p}>{names.get(p) ?? p}</li>
                ))}
              </ul>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader level="h2" title="Their own code" />
          <PanelBody>
            {customer.ownCode ? (
              <Details
                items={[
                  ["Package", <Code key="p">{customer.ownCode.package}</Code>],
                  ["Pages", customer.ownCode.routes.map((r) => `/${r}`).join(", ") || "—"],
                  ["Outlets", customer.ownCode.slots.join(", ") || "—"],
                ]}
              />
            ) : (
              <p className="text-sm text-ink-3">
                None. Code only this customer needs goes in <Code>customers/{customer.id}</Code> as a package — see the README.
              </p>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader level="h2" title="Record" />
          <PanelBody className="flex flex-col gap-4">
            <Details items={[["Created", formatDay(customer.createdAt)], ["Status", customer.archivedAt ? `Archived ${formatDay(customer.archivedAt)}` : "Active"]]} />
            {issuer ? <ArchiveCustomer id={customer.id} archived={Boolean(customer.archivedAt)} installations={customer.installations} /> : null}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
