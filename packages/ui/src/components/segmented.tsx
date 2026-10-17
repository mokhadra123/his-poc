import type { ComponentProps } from "react";
import { tv } from "../lib/tv";

/*
 * A row of mutually exclusive toggle buttons. The selected state is weighted
 * by clinical meaning, not by position:
 *   alarm    an abnormal finding shouts       (solid critical)
 *   confirm  a normal finding is confirmed    (stable tint)
 *   quiet    "not examined" stays quiet       (surface + outline)
 *   select   a plain choice, no clinical meaning (the default)
 *
 * Every selected state also carries a non-colour cue (weight + inset
 * outline), so it survives colour blindness and greyscale.
 *
 * No overflow-hidden on the group: it would clip the focus ring. The
 * corners are rounded on the first and last item instead.
 */
export const segmented = tv({
  slots: {
    // isolate: the focused item's z-index stays inside the group, under sticky bars
    root: "isolate inline-flex max-w-full rounded-ctl border border-line max-sm:w-full max-sm:flex-col",
    item: [
      "relative h-toggle cursor-pointer border-e border-line bg-surface px-3 text-sm whitespace-nowrap text-ink-3",
      "first:rounded-s-ctl last:rounded-e-ctl last:border-e-0 hover:bg-surface-2 focus-visible:z-10",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // on phones the options stack full width instead of running off the screen
      "max-sm:h-auto max-sm:min-h-toggle max-sm:py-1.5 max-sm:text-start max-sm:whitespace-normal",
      "max-sm:border-e-0 max-sm:border-b max-sm:last:border-b-0",
      "max-sm:first:rounded-none max-sm:first:rounded-t-ctl max-sm:last:rounded-none max-sm:last:rounded-b-ctl",
    ],
  },
  variants: {
    weight: { confirm: {}, alarm: {}, quiet: {}, select: {} },
    selected: { true: { item: "font-semibold" } },
  },
  compoundVariants: [
    {
      selected: true,
      weight: "confirm",
      class: { item: "bg-stable-soft text-stable shadow-[inset_0_0_0_1.5px_var(--stable)] hover:bg-stable-soft" },
    },
    {
      selected: true,
      weight: "alarm",
      class: { item: "bg-critical-solid text-critical-solid-ink hover:bg-critical-solid" },
    },
    {
      selected: true,
      weight: "quiet",
      class: { item: "bg-surface-2 text-ink-2 shadow-[inset_0_0_0_1.5px_var(--ink-3)]" },
    },
    {
      selected: true,
      weight: "select",
      class: { item: "bg-surface-2 text-ink shadow-[inset_0_0_0_1.5px_var(--ink-2)]" },
    },
  ],
});

export type SegmentedOption<V extends string> = {
  value: V;
  label: string;
  weight?: "confirm" | "alarm" | "quiet" | "select";
  disabled?: boolean;
};

type SegmentedProps<V extends string> = Omit<ComponentProps<"div">, "onChange"> & {
  options: readonly SegmentedOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  /** accessible name of the group, e.g. the body system */
  label: string;
};

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  label,
  className,
  ...props
}: SegmentedProps<V>) {
  return (
    <div role="group" aria-label={label} className={segmented().root({ className })} {...props}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={segmented({ selected, weight: o.weight ?? "select" }).item()}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
