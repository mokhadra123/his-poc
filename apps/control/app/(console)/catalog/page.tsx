import { PageHeader, Panel, Status, Table, Td, Th, Tr } from "@his/ui";
import type { Product } from "@his/licence/api";
import { Package } from "lucide-react";
import { Code, EmptyState, Page } from "@/components/bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { can, currentUser, get } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { RunButton } from "../run-button";

export const metadata = { title: "Products" };

export default async function CatalogPage() {
  const [user, products] = await Promise.all([currentUser(), get<Product[]>("/api/catalog")]);
  const synced = products.map((p) => p.syncedAt).sort().at(-1);

  return (
    <>
      <ConsoleTopbar current="Products" />
      <Page>
        <PageHeader
          title="Products"
          subtitle={`What can be sold: every package with a his.product.json. Last read ${synced ? formatTime(synced) : "never"}.`}
          actions={can(user, "issuer") ? <RunButton action="sync" label="Sync from the repository" /> : null}
        />
        <Panel>
          {products.length ? (
            <Table label="Products">
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Id</Th>
                  <Th>Package</Th>
                  <Th>Pages</Th>
                  <Th>Outlets</Th>
                  <Th>Active licences</Th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <span className="font-medium">{p.name.en}</span>{" "}
                      <bdi lang="ar" className="text-sm text-ink-3">
                        {p.name.ar}
                      </bdi>
                      {p.retired ? <Status state="quiet" className="ms-2">retired</Status> : null}
                    </Td>
                    <Td>
                      <Code>{p.id}</Code>
                    </Td>
                    <Td tone="dim">
                      <Code className="text-xs">{p.package}</Code>
                    </Td>
                    <Td tone="wrap">{p.routes.map((r) => `/${r}`).join(", ") || "—"}</Td>
                    <Td tone="dim">{p.slots.join(", ") || "—"}</Td>
                    <Td>{p.licences}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={Package} title="The catalog is empty">
              No package in the repository has a his.product.json yet.
            </EmptyState>
          )}
        </Panel>
        <p className="mt-3 text-xs text-ink-3">
          Core is not a product: it is in every build. A retired product left the repository; licences that name it still verify,
          but new licences cannot include it.
        </p>
      </Page>
    </>
  );
}
