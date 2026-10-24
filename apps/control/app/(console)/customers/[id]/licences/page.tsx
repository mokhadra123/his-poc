import { Panel } from "@his/ui";
import type { LicenceRow } from "@his/licence/api";
import { FileKey2 } from "lucide-react";
import { EmptyState } from "@/components/bits";
import { LicenceTable } from "@/components/licence-table";
import { get } from "@/lib/api";

export default async function CustomerLicences({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const licences = await get<LicenceRow[]>(`/api/licences?customerId=${encodeURIComponent(id)}`);
  return (
    <Panel>
      {licences.length ? (
        <LicenceTable licences={licences} customer={false} />
      ) : (
        <EmptyState icon={FileKey2} title="No licences yet">
          Licences are issued per installation. Add an installation first, then issue its licence.
        </EmptyState>
      )}
    </Panel>
  );
}
