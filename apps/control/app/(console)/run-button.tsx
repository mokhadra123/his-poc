"use client";

import { Button } from "@his/ui";
import { KeyRound, LoaderCircle, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { type ActionResult, rotateKey, syncCatalog } from "@/app/actions";
import { Notice } from "@/components/fields";

const ACTIONS = { sync: { run: syncCatalog, icon: RefreshCw }, rotate: { run: rotateKey, icon: KeyRound } };

/** A one-click operation with its outcome shown under it. `confirm` asks first. */
export function RunButton({ action, label, confirm }: { action: keyof typeof ACTIONS; label: string; confirm?: string }) {
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const { run, icon: Icon } = ACTIONS[action];
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        tone="primary"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setResult(await run()));
        }}
      >
        {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Icon aria-hidden />}
        {label}
      </Button>
      {result ? (
        <Notice tone={result.ok ? "done" : "problem"} title={result.ok ? result.message : result.error} className="max-w-md" />
      ) : null}
    </div>
  );
}
