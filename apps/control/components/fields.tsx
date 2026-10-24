"use client";

import { Button, type ButtonProps, cn } from "@his/ui";
import { CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";
import { useFormStatus } from "react-dom";

/*
 * Form pieces the design system does not have yet, built only from its roles
 * (the same idiom as the customer panel). Every field has a real <label>,
 * its hint and its error are announced with it (aria-describedby), and an
 * error is told by text and an icon, not by colour.
 */

export const inputClass = cn(
  "h-control w-full min-w-0 rounded-ctl border border-control-line bg-input px-3 text-md text-ink",
  "placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
  "read-only:bg-surface-2 read-only:text-ink-2 disabled:opacity-60",
  "aria-[invalid=true]:border-ink aria-[invalid=true]:border-2",
);

type FieldFrame = { label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; className?: string };

function Frame({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldFrame & { id: string; children: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
        {required ? (
          <span aria-hidden className="ms-0.5 text-ink-3">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-xs font-semibold text-ink">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

const described = (id: string, hint?: ReactNode, error?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function TextField({ label, hint, error, className, required, ...props }: ComponentProps<"input"> & FieldFrame) {
  const id = useId();
  return (
    <Frame id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={described(id, hint, error)}
        className={inputClass}
        {...props}
      />
    </Frame>
  );
}

export function TextArea({ label, hint, error, className, required, ...props }: ComponentProps<"textarea"> & FieldFrame) {
  const id = useId();
  return (
    <Frame id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={described(id, hint, error)}
        className={cn(inputClass, "h-auto min-h-24 py-2 leading-normal")}
        {...props}
      />
    </Frame>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  required,
  children,
  ...props
}: ComponentProps<"select"> & FieldFrame) {
  const id = useId();
  return (
    <Frame id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={described(id, hint, error)}
        className={cn(inputClass, "cursor-pointer pe-8")}
        {...props}
      >
        {children}
      </select>
    </Frame>
  );
}

/** A radio group drawn as cards: a choice with an explanation under each option. */
export function ChoiceCards<V extends string>({
  name,
  legend,
  value,
  onChange,
  options,
  columns = 2,
}: {
  name: string;
  legend: string;
  value: V;
  onChange?: (value: V) => void;
  options: { value: V; label: string; help: string }[];
  columns?: 2 | 3;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium text-ink-2">{legend}</legend>
      <div className={cn("grid gap-2", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer gap-2.5 rounded-ctl border border-line bg-surface p-3 hover:bg-surface-2",
              "has-checked:border-accent-text has-checked:bg-accent-soft",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={onChange ? undefined : value === o.value}
              checked={onChange ? value === o.value : undefined}
              onChange={onChange ? () => onChange(o.value) : undefined}
              className="mt-0.5 size-4 shrink-0 accent-accent outline-none"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-ink">{o.label}</span>
              <span className="text-xs text-ink-3">{o.help}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The form's submit button: shows that it is working and cannot be pressed twice. */
export function SubmitButton({ children, pendingText, ...props }: ButtonProps & { pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-disabled={pending || undefined} {...props}>
      {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
      {pending ? pendingText : children}
    </Button>
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
  action,
  className,
}: {
  tone?: "info" | "problem" | "done";
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = tone === "problem" ? TriangleAlert : tone === "done" ? CircleCheck : Info;
  return (
    <div
      role={tone === "problem" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-card border px-4 py-3 text-sm",
        tone === "problem" ? "border-ink-3 bg-surface-2 text-ink" : "border-line bg-surface text-ink-2",
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className={cn("text-ink", tone !== "info" && "font-semibold")}>{title}</div>
        {/* one block, so inline content (code, links) flows as text */}
        {children ? <div>{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2 max-sm:w-full">{action}</div> : null}
    </div>
  );
}

/** The outcome of a form, said once where the person is looking. */
export function ActionMessage({ result }: { result: { ok: boolean; message?: string; error?: string } | null }) {
  if (!result) return null;
  return result.ok ? (
    <Notice tone="done" title={result.message} />
  ) : (
    <Notice tone="problem" title={result.error ?? "Not saved"} />
  );
}
