"use client";

import { Button } from "@his/ui";
import { Upload } from "lucide-react";
import { useActionState, useId } from "react";
import { type InstallState, installLicenceAction } from "@/app/(app)/licence/actions";
import { Notice } from "@/components/notice";
import type { Dict } from "@/lib/i18n";

/**
 * Upload a renewed licence (an air-gapped installation's only way to renew).
 * Never disabled by read-only: it is how read-only ends.
 */
export function LicenceInstallForm({ t }: { t: Dict["licence"]["install"] }) {
  const [result, action, pending] = useActionState<InstallState, FormData>(installLicenceAction, null);
  const id = useId();

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium text-ink-2">
          {t.file}
        </label>
        <input
          id={id}
          name="licence"
          type="file"
          accept=".json,application/json"
          required
          aria-describedby={`${id}-hint`}
          className={[
            "min-w-0 rounded-ctl text-sm text-ink-2",
            "file:me-3 file:h-control-sm file:cursor-pointer file:rounded-ctl file:border file:border-line file:bg-surface file:px-2.5 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-2",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          ].join(" ")}
        />
        <p id={`${id}-hint`} className="text-xs text-ink-3">
          {t.note}
        </p>
      </div>
      <div>
        <Button tone="primary" type="submit" disabled={pending}>
          <Upload aria-hidden />
          {pending ? t.pending : t.submit}
        </Button>
      </div>
      {result ? (
        <Notice tone={result.ok ? "done" : "problem"} title={result.title}>
          {result.detail ? (
            <p dir="ltr" className="text-start font-mono text-xs text-ink-2">
              {result.detail}
            </p>
          ) : null}
        </Notice>
      ) : null}
    </form>
  );
}
