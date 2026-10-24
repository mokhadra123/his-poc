"use client";

import { Button } from "@his/ui";
import { Ban } from "lucide-react";
import { useActionState, useState } from "react";
import { type ActionResult, revokeLicence } from "@/app/actions";
import { ActionMessage, SubmitButton, TextArea } from "@/components/fields";

/** Revoking is deliberate: open it, say why, confirm. */
export function RevokeLicence({
  id,
  online,
  graceDays,
  replaces,
}: {
  id: string;
  online: boolean;
  graceDays: number;
  /** the licence this one renewed: revoking makes it current again */
  replaces: { id: string; expiresOn: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [result, action] = useActionState<ActionResult, FormData>(revokeLicence.bind(null, id), null);
  const consequence = replaces
    ? `This licence renewed ${replaces.id.slice(0, 8)} (until ${replaces.expiresOn}); revoking it makes that one current again${
        online ? ", and the installation gets it back at its next heartbeat" : ""
      }. To end that one too, revoke it next.`
    : online
      ? `The installation learns it at its next heartbeat, then has ${graceDays} days of grace before it turns read-only.`
      : `It is offline, so it will not learn this: its file keeps working until it expires. Revoking here records the decision and stops renewals.`;

  if (!open) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-ink-3">{consequence}</p>
        <Button size="sm" className="self-start" onClick={() => setOpen(true)}>
          <Ban aria-hidden />
          Revoke this licence…
        </Button>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">{consequence}</p>
      <TextArea
        label="Reason"
        name="reason"
        required
        minLength={3}
        maxLength={300}
        placeholder="Contract ended, issued by mistake …"
        error={result && !result.ok ? result.fields.reason : undefined}
        hint="Recorded in the activity log and told to the installation."
        autoFocus
      />
      <ActionMessage result={result && !result.ok && !result.fields.reason ? result : null} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton tone="primary" pendingText="Revoking…">
          <Ban aria-hidden />
          Revoke licence
        </SubmitButton>
        <Button tone="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
