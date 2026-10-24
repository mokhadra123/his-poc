import { NameCell, Table, Td, Th, Tr } from "@his/ui";
import type { LicenceRow } from "@his/licence/api";
import Link from "next/link";
import { Code, LicenceStatus, ProductTags } from "@/components/bits";
import { formatDay, relativeDays } from "@/lib/format";

/** Licences as a table; `customer` off when the page is already about one customer. */
export function LicenceTable({ licences, customer = true }: { licences: LicenceRow[]; customer?: boolean }) {
  return (
    <Table label="Licences">
      <thead>
        <tr>
          <Th>Licence</Th>
          {customer ? <Th>Customer</Th> : null}
          <Th>Installation</Th>
          <Th>State</Th>
          <Th>Ends</Th>
          <Th>Products</Th>
          <Th>Issued</Th>
        </tr>
      </thead>
      <tbody>
        {licences.map((l) => {
          const active = l.status === "active";
          return (
            <Tr key={l.id}>
              <Td>
                <Link href={`/licences/${l.id}`} className="font-medium hover:underline">
                  <Code className="text-sm text-ink">{l.id.slice(0, 8)}</Code>
                </Link>
              </Td>
              {customer ? (
                <Td>
                  <Link href={`/customers/${l.customerId}`} className="hover:underline">
                    <NameCell primary={l.customerName.en} secondary={l.customerName.ar} secondaryLang="ar" />
                  </Link>
                </Td>
              ) : null}
              <Td>{l.installationLabel}</Td>
              <Td>
                <LicenceStatus display={l.display} />
              </Td>
              <Td tone="dim">
                {formatDay(l.evaluation.timeline.endsOn)}
                {active ? <span className="block text-xs">{relativeDays(l.evaluation.daysLeft)}</span> : null}
              </Td>
              <Td tone="wrap">
                <ProductTags ids={l.products} />
              </Td>
              <Td tone="dim">
                {formatDay(l.issuedAt)}
                <span className="block text-xs">by {l.issuedBy}</span>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
