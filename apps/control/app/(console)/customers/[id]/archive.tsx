"use client";

import { Button } from "@his/ui";
import { Archive, ArchiveRestore } from "lucide-react";
import { useState, useTransition } from "react";
import { type ActionResult, setCustomerArchived } from "@/app/actions";
import { ActionMessage } from "@/components/fields";

/** Archiving hides a customer that no longer runs HIS; it needs no installations left. */
export function ArchiveCustomer({ id, archived, installations }: { id: string; archived: boolean; installations: number }) {
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const blocked = !archived && installations > 0;
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        className="self-start"
        disabled={pending || blocked}
        aria-describedby={blocked ? `${id}-archive-why` : undefined}
        onClick={() => start(async () => setResult(await setCustomerArchived(id, !archived)))}
      >
        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        {archived ? "Restore customer" : "Archive customer"}
      </Button>
      {blocked ? (
        <p id={`${id}-archive-why`} className="text-xs text-ink-3">
          Retire its {installations} installation{installations === 1 ? "" : "s"} first — archiving never stops a running hospital.
        </p>
      ) : null}
      <ActionMessage result={result} />
    </div>
  );
}
