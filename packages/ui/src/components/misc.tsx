import { Search, TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn, tv, type VariantProps } from "../lib/tv";

/* ---------- search field ---------- */

export const searchField = tv({
  slots: {
    root: [
      "flex h-control min-w-0 items-center gap-2 rounded-ctl border px-3 text-sm [&_svg]:size-4 [&_svg]:shrink-0",
      // the input drops its own outline, so the whole field shows the ring
      "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
    ],
    input: "min-w-0 flex-1 bg-transparent outline-none placeholder:text-current",
  },
  variants: {
    tone: {
      default: { root: "border-control-line bg-input text-ink-3" },
      /** sitting on the chrome band */
      chrome: { root: "border-chrome-field-line bg-chrome-field text-chrome-field-ink" },
    },
  },
  defaultVariants: { tone: "default" },
});

export function SearchField({
  tone,
  label,
  landmark = true,
  className,
  ...props
}: ComponentProps<"input"> &
  VariantProps<typeof searchField> & {
    /** accessible name — a placeholder is not one */
    label: string;
    /** the page's search: a named search landmark. Off for demos and filters. */
    landmark?: boolean;
  }) {
  const s = searchField({ tone });
  return (
    <div {...(landmark ? { role: "search", "aria-label": label } : {})} className={s.root({ className })}>
      <Search aria-hidden />
      <input type="search" aria-label={label} className={s.input()} {...props} />
    </div>
  );
}

/* ---------- direction ---------- */

/**
 * IDs, phone numbers and codes read left-to-right even inside Arabic.
 * Without this, "208-4471" next to Arabic letters renders as "4471-208":
 * the digits become Arabic numbers and the hyphen flips between them.
 */
export function Ltr({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}

/* ---------- avatar ---------- */

/** Avatars are identity, not actions — neutral, never the accent. */
export const avatar = tv({
  base: "grid shrink-0 place-items-center rounded-full bg-surface-2 font-semibold text-ink-2",
  variants: {
    size: {
      sm: "size-7 text-2xs",
      lg: "size-11 rounded-card text-lg",
    },
  },
  defaultVariants: { size: "sm" },
});

export function Avatar({
  size,
  className,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof avatar>) {
  return <span className={avatar({ size, className })} {...props} />;
}

/* ---------- vitals ---------- */

export function Vitals({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("grid grid-cols-3 gap-px bg-line", className)} {...props} />;
}

type VitalProps = {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
} & (
  | { flagged?: false; flaggedLabel?: never }
  | {
      /** out of range — shown with an alert mark (not colour alone) and announced */
      flagged: true;
      /** translated, e.g. "out of range" */
      flaggedLabel: string;
    }
);

export function Vital({ label, value, unit, flagged, flaggedLabel }: VitalProps) {
  return (
    <div className={cn("relative bg-surface px-3 py-3", flagged && "bg-critical-soft")}>
      <div className="text-xs text-ink-3">{label}</div>
      {/* value and unit are separate flex items, so the gap stays between them in RTL */}
      <div
        className={cn(
          "mt-1 inline-flex items-baseline gap-1 text-xl font-semibold tracking-tight",
          flagged && "text-critical",
        )}
      >
        {flagged ? <TriangleAlert aria-hidden className="size-3.5 shrink-0 self-center" /> : null}
        <span>{value}</span>
        {/* dir=auto: "°C" stays "°C" in Arabic, "كغ" stays right-to-left */}
        {unit ? (
          <small dir="auto" className="text-xs font-normal text-ink-3">
            {unit}
          </small>
        ) : null}
        {flagged ? <span className="sr-only"> ({flaggedLabel})</span> : null}
      </div>
    </div>
  );
}

/* ---------- list row (queues, worklists) ---------- */

export const listRow = tv({
  slots: {
    // wraps on narrow screens: the chips drop below the title instead of crushing it
    root: "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-2 px-pad py-row-y last:border-b-0",
    lead: "w-12 shrink-0 text-sm text-ink-3",
    main: "min-w-40 flex-1",
    title: "text-md font-medium",
    meta: "mt-0.5 text-xs text-ink-3",
    end: "ms-auto flex flex-wrap items-center justify-end gap-2",
  },
});

export function ListRow({
  lead,
  title,
  meta,
  end,
}: {
  lead?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  end?: ReactNode;
}) {
  const s = listRow();
  return (
    <div className={s.root()}>
      {lead ? <div className={s.lead()}>{lead}</div> : null}
      <div className={s.main()}>
        <div className={s.title()}>{title}</div>
        {meta ? <div className={s.meta()}>{meta}</div> : null}
      </div>
      {end ? <div className={s.end()}>{end}</div> : null}
    </div>
  );
}

/* ---------- page header ---------- */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-5">
      <div>
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-heading-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-md text-ink-3">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ms-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------- sticky action bar ---------- */

/**
 * Sticks to the bottom of the scroll container, which needs `scroll-pb-24`
 * so a focused control is never hidden under it. On phones the bar wraps
 * taller than that, so there it simply sits at the end of the form.
 */
export function ActionBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        // one line on purpose: a wrapped bar would be taller than the scroll padding
        "sticky bottom-4 z-10 mt-stack flex flex-nowrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-float",
        // on phones the bar is not sticky, so it may wrap
        "max-sm:static max-sm:flex-wrap print:hidden",
        "[&>[data-primary]]:ms-auto",
        className,
      )}
      {...props}
    />
  );
}
