import type { ComponentProps } from "react";
import { tv, type VariantProps } from "../lib/tv";

/*
 * Two components on purpose, so the rule is in the API and not in a review:
 *
 *   <Signal>  clinical state. Tinted, with a marker whose SHAPE also carries
 *             the tone (critical ▲, caution ◆, stable ●, info ○), so it reads
 *             without colour, and a spoken tone label for screen readers.
 *             The ONLY coloured chip.
 *   <Status>  operational state (billing, workflow, stock, documents).
 *             Neutral, square marker. It cannot be red — an unpaid invoice
 *             must never look like an anaphylaxis.
 */

export const signal = tv({
  base: [
    // relative: keeps the sr-only tone label inside any scroll container
    "relative inline-flex h-chip items-center gap-1.5 whitespace-nowrap rounded-chip px-2 text-xs font-medium",
    // forced colours would erase the marker's background, and the shape IS the cue
    "before:shrink-0 before:bg-current before:forced-color-adjust-none forced-colors:before:bg-[CanvasText]",
  ],
  variants: {
    tone: {
      critical:
        "bg-critical-soft font-semibold text-critical before:size-2 before:[clip-path:polygon(50%_0,100%_100%,0_100%)]",
      caution: "bg-caution-soft text-caution before:size-1.5 before:rotate-45",
      stable: "bg-stable-soft text-stable before:size-1.5 before:rounded-full",
      info: [
        "bg-info-soft text-info before:size-1.5 before:rounded-full before:border-[1.5px] before:border-current before:bg-transparent",
        "forced-colors:before:border-[CanvasText] forced-colors:before:bg-transparent",
      ],
    },
  },
  defaultVariants: { tone: "info" },
});

export type SignalTone = NonNullable<VariantProps<typeof signal>["tone"]>;

export type SignalProps = ComponentProps<"span"> &
  VariantProps<typeof signal> & {
    /** spoken before the text, e.g. "Critical" — pass it translated */
    toneLabel?: string;
  };

export function Signal({ tone, toneLabel, className, children, ...props }: SignalProps) {
  return (
    <span className={signal({ tone, className })} {...props}>
      {toneLabel ? <span className="sr-only">{toneLabel}: </span> : null}
      {children}
    </span>
  );
}

export const status = tv({
  base: [
    "inline-flex h-chip items-center gap-1.5 whitespace-nowrap rounded-chip border px-2 text-xs",
    "before:size-1.5 before:shrink-0 before:forced-color-adjust-none",
  ],
  variants: {
    state: {
      /** nothing to do: active, checked in, discharged */
      quiet: "border-line-2 bg-transparent text-ink-3 before:hidden",
      /** waiting on something: waiting, due, unconfirmed */
      pending: "border-line bg-surface text-ink-2 before:border before:border-current forced-colors:before:border-[CanvasText]",
      /** finished: confirmed, vitals done */
      done: "border-line bg-surface text-ink-2 before:bg-ink-3 forced-colors:before:bg-[CanvasText]",
      /** someone must act: rejected, overdue, missing, low stock, unpaid */
      attention: "border-ink-3 bg-surface-2 font-semibold text-ink before:bg-current forced-colors:before:bg-[CanvasText]",
    },
  },
  defaultVariants: { state: "quiet" },
});

export type StatusProps = ComponentProps<"span"> & VariantProps<typeof status>;

export function Status({ state, className, ...props }: StatusProps) {
  return <span className={status({ state, className })} {...props} />;
}

/** a count or timestamp beside a heading — not a state at all */
export function Meta({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={signal({
        className: [
          "max-w-full bg-surface-2 font-normal text-ink-3 before:hidden",
          "max-sm:h-auto max-sm:min-h-chip max-sm:py-0.5 max-sm:whitespace-normal",
          className,
        ],
      })}
      {...props}
    />
  );
}
