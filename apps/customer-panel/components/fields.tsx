"use client";

import { cn } from "@his/ui";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";

/* Small form pieces the design system does not have yet, built from its roles. */

const input = cn(
  "h-control w-full min-w-0 rounded-ctl border border-control-line bg-input px-3 text-md text-ink",
  "placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
  "read-only:bg-surface-2 read-only:text-ink-2",
);

export function TextField({
  label,
  hint,
  className,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} className={input} {...props} />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A message box. Operations stay neutral in this design system (colour is for
 * clinical state), so a problem is told by its icon, weight and border.
 */
export function Notice({
  tone = "info",
  title,
  children,
  output,
}: {
  tone?: "info" | "problem" | "done";
  title: ReactNode;
  children?: ReactNode;
  output?: string;
}) {
  const Icon = tone === "problem" ? TriangleAlert : tone === "done" ? CircleCheck : Info;
  return (
    <div
      role={tone === "problem" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-card border px-4 py-3 text-sm",
        tone === "problem" ? "border-ink-3 bg-surface-2 text-ink" : "border-line bg-surface text-ink-2",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className={cn(tone === "problem" && "font-semibold")}>{title}</div>
        {children}
        {output ? (
          <pre className="mt-1 max-h-72 overflow-auto rounded-ctl border border-line bg-surface p-3 font-mono text-xs whitespace-pre-wrap text-ink-2">
            {output.trim()}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
