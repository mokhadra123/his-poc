"use client";

import { Button, cn } from "@his/ui";
import { Hammer, LoaderCircle } from "lucide-react";
import { type ComponentProps, useState, useTransition } from "react";
import { type ActionResult, buildRelease } from "@/app/actions";
import { ActionMessage } from "@/components/fields";

/** Starts a build of the installation's active licence and opens its release page */
export function BuildReleaseButton({
  installationId,
  disabled,
  label = "Build release",
  tone,
  className,
}: {
  installationId: string;
  disabled?: boolean;
  label?: string;
  tone?: ComponentProps<typeof Button>["tone"];
  className?: string;
}) {
  const [result, setResult] = useState<ActionResult>(null);
  const [starting, start] = useTransition();
  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      <Button size="sm" tone={tone} disabled={starting || disabled} onClick={() => start(async () => setResult(await buildRelease(installationId)))}>
        {starting ? <LoaderCircle aria-hidden className="animate-spin" /> : <Hammer aria-hidden />}
        {starting ? "Starting…" : label}
      </Button>
      <ActionMessage result={result && !result.ok ? result : null} />
    </div>
  );
}
