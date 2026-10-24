"use client";

import { Button, type ButtonProps, cn } from "@his/ui";
import { Lock } from "lucide-react";
import { createContext, type ReactNode, use } from "react";
import { LICENCE_NOTICE_ID } from "@/lib/licence-text";

/*
 * Read-only, as client components see it: app/(app)/layout.tsx works it out
 * from the installed licence (lib/licence.ts) and provides it here.
 *
 * This only disables what creates or changes records, so nobody types into a
 * form that cannot be saved. It is not the enforcement: the backend must
 * refuse those writes itself, with the same licence check, once it exists.
 */
const ReadOnly = createContext(false);

export function LicenceProvider({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return <ReadOnly value={readOnly}>{children}</ReadOnly>;
}

export function useReadOnly() {
  return use(ReadOnly);
}

/**
 * A button that creates or changes a record. Read-only, it stays focusable
 * (aria-disabled, not disabled) so a screen reader still finds it and hears
 * why, from the licence banner it points at; it does nothing when pressed.
 */
export function WriteButton({ className, onClick, "aria-describedby": describedBy, ...props }: ButtonProps) {
  const readOnly = useReadOnly();
  if (!readOnly) return <Button className={className} onClick={onClick} aria-describedby={describedBy} {...props} />;
  return (
    <Button
      {...props}
      type="button"
      aria-disabled
      aria-describedby={[describedBy, LICENCE_NOTICE_ID].filter(Boolean).join(" ")}
      onClick={(event) => event.preventDefault()}
      className={cn("aria-disabled:pointer-events-none aria-disabled:opacity-50", className)}
    />
  );
}

/** Next to a form's actions: read-only says so, otherwise the usual text (children). */
export function ReadOnlyNote({ note, className, children }: { note: string; className?: string; children?: ReactNode }) {
  const readOnly = useReadOnly();
  if (!readOnly) return <span className={className}>{children}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-medium text-ink", className)}>
      <Lock aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{note}</span>
    </span>
  );
}
