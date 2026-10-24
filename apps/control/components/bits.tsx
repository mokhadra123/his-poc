import { button, cn, Status } from "@his/ui";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type { LicenceDisplay, Standing } from "@his/licence/api";
import { DISPLAY } from "@/lib/format";

/* Small server-safe pieces every page uses. */

/** The page body under the top bar */
export function Page({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return <div className={cn("px-gutter pt-page-y pb-14", narrow ? "max-w-[960px]" : "max-w-[1480px]")}>{children}</div>;
}

/** A link that looks like a button (a button inside a link is not valid HTML) */
export function LinkButton({
  tone,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { tone?: "neutral" | "primary" | "ghost"; size?: "md" | "sm" }) {
  return <Link className={button({ tone, size, className })} {...props} />;
}

/** A licence (or a customer's standing) as a neutral status: the word carries the meaning */
export function LicenceStatus({ display, className }: { display: LicenceDisplay | Standing["state"]; className?: string }) {
  const d = DISPLAY[display];
  return (
    <Status state={d.state} title={d.help} className={className}>
      {d.label}
    </Status>
  );
}

/** Nothing here yet — and what to do about it */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-pad py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink-3">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {children ? <div className="max-w-md text-sm text-ink-3">{children}</div> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** A label/value list for record details */
export function Details({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[minmax(8rem,auto)_minmax(0,1fr)] max-sm:[&_dd]:mb-1", className)}>
      {items.map(([term, value], i) => (
        <div key={i} className="contents">
          <dt className="text-ink-3">{term}</dt>
          <dd className="min-w-0 break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Ids and keys: monospace, left-to-right even inside Arabic */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("font-mono text-sm text-ink-2", className)}>
      {children}
    </bdi>
  );
}

const THEME_NAME: Record<string, string> = {
  slate: "Slate",
  ink: "Ink",
  pine: "Pine",
  graphite: "Graphite",
  custom: "Hospital colour",
  original: "HIS today",
};

/** A customer's themes in one line: a dot in its default theme's accent, the name, and how many more */
export function ThemeSummary({ theme }: { theme: { default: string; allowed: string[]; brand: string | null } }) {
  const more = theme.allowed.length - 1;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
      {/* data-theme scopes that theme's tokens to the dot; the hospital colour is set inline */}
      <span
        aria-hidden
        data-theme={theme.default}
        style={theme.default === "custom" && theme.brand ? ({ "--brand-custom": theme.brand } as CSSProperties) : undefined}
        className="size-3 shrink-0 rounded-full border border-line bg-accent"
      />
      {THEME_NAME[theme.default] ?? theme.default}
      {more > 0 ? <span className="text-xs text-ink-3">+{more}</span> : null}
    </span>
  );
}

/** A product id as a small neutral tag */
export function ProductTag({ id }: { id: string }) {
  return (
    <span className="inline-flex h-chip items-center rounded-chip border border-line bg-surface-2 px-2 font-mono text-xs text-ink-2">
      {id}
    </span>
  );
}

export function ProductTags({ ids, empty = "Core only" }: { ids: string[]; empty?: string }) {
  if (ids.length === 0) return <span className="text-sm text-ink-3">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <ProductTag key={id} id={id} />
      ))}
    </span>
  );
}
