import type { ComponentProps, ReactNode } from "react";
import { tv } from "../lib/tv";

/*
 * Shell recipes. The app composes these with its own router <Link>, so the
 * design system never imports a framework.
 *
 * Collapsing is driven by data-nav="collapsed" on <html>, read through the
 * `nav-collapsed:` variant — no React state, and it survives a reload. Below
 * md the variant always applies, so small screens get the icon rail.
 *
 * Focus rings: the chrome and the navigation set their own --focus, because
 * a ring in the brand colour vanishes on a brand-coloured band or a dark rail.
 */
export const sidebar = tv({
  slots: {
    root: [
      "flex h-full w-nav shrink-0 flex-col overflow-hidden border-e border-nav-line bg-nav bg-(image:--nav-image) text-nav-ink",
      "nav-collapsed:w-rail print:hidden",
    ],
    head: [
      // the head belongs to the top band by default; a theme can tie it to the rail (nav-head roles)
      "flex h-topbar shrink-0 items-center gap-2.5 border-b border-nav-head-line bg-nav-head px-3.5 [--focus:var(--nav-head-focus)]",
      "nav-collapsed:justify-center nav-collapsed:px-0",
    ],
    mark: "grid size-(--mark-size) shrink-0 place-items-center rounded-(--mark-radius) bg-mark text-sm font-bold text-mark-ink nav-collapsed:hidden",
    name: "truncate text-lg font-semibold text-nav-head-ink nav-collapsed:hidden",
    sub: "truncate text-2xs text-nav-head-ink-dim nav-collapsed:hidden",
    toggle: [
      "ms-auto grid size-6.5 shrink-0 cursor-pointer place-items-center rounded-ctl text-nav-head-ink-dim",
      "hover:bg-nav-head-hover hover:text-nav-head-ink nav-collapsed:ms-0 max-md:hidden [&_svg]:size-4 rtl:[&_svg]:-scale-x-100",
    ],
    body: "flex-1 overflow-y-auto px-2.5 py-2.5 [--focus:var(--nav-focus)]",
    group: [
      "mt-4 first:mt-0",
      "nav-collapsed:mt-3 nav-collapsed:border-t nav-collapsed:border-nav-line nav-collapsed:pt-3",
      "nav-collapsed:first:mt-0 nav-collapsed:first:border-t-0 nav-collapsed:first:pt-0",
    ],
    section: "mx-3 mb-1 text-2xs font-medium whitespace-nowrap text-nav-ink-dim nav-collapsed:hidden",
    item: [
      "relative mb-px flex h-nav-item items-center gap-3 rounded-(--nav-radius) px-3 text-(length:--nav-fs) whitespace-nowrap",
      "transition-colors duration-100 hover:bg-nav-hover hover:text-nav-ink-strong",
      "aria-[current]:bg-nav-active aria-[current]:[font-weight:var(--nav-active-weight)] aria-[current]:text-nav-active-ink",
      "before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:bg-nav-marker before:opacity-0 aria-[current]:before:opacity-100",
      "[&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.7] focus-visible:z-10",
      "nav-collapsed:justify-center nav-collapsed:px-0",
    ],
    label: "nav-collapsed:sr-only",
    // on the current row the count follows the row's stronger ink
    count: "ms-auto text-2xs text-nav-ink-dim nav-collapsed:hidden [[aria-current]>&]:text-nav-active-ink",
    foot: [
      "flex shrink-0 items-center gap-2.5 border-t border-nav-line bg-nav-foot px-3.5 py-2.5",
      "nav-collapsed:justify-center nav-collapsed:px-0",
    ],
    footText: "min-w-0 nav-collapsed:hidden",
    footName: "truncate text-sm font-medium text-nav-ink-strong",
    footRole: "truncate text-2xs text-nav-ink-dim",
  },
});

export const topbar = tv({
  slots: {
    root: [
      "sticky top-0 z-20 flex h-topbar shrink-0 items-center gap-3.5 border-b border-chrome-line bg-chrome px-gutter print:static",
      "[--focus:var(--chrome-focus)]",
    ],
    crumb: "min-w-0 truncate text-sm whitespace-nowrap text-chrome-ink-dim",
    current: "font-medium text-chrome-ink",
    end: "ms-auto flex min-w-0 items-center gap-2.5",
    iconButton: [
      "relative grid size-(--chrome-icon-size) shrink-0 cursor-pointer place-items-center rounded-(--chrome-icon-radius) border border-chrome-icon-line bg-chrome-icon text-chrome-icon-ink [box-shadow:var(--chrome-icon-shadow)]",
      "hover:text-chrome-ink [&_svg]:size-4 [&_svg]:stroke-[1.7]",
    ],
    // unread is not a clinical state, so the dot is the chrome ink, not critical
    dot: "absolute end-1.5 top-1.5 size-1.5 rounded-full bg-chrome-ink ring-2 ring-chrome",
  },
});

export function Topbar({
  crumbs,
  current,
  end,
}: {
  crumbs: ReactNode[];
  current: ReactNode;
  end?: ReactNode;
}) {
  const s = topbar();
  return (
    <header className={s.root()}>
      <span className={s.crumb()}>
        {crumbs.map((c, i) => (
          <span key={i}>{c} / </span>
        ))}
        <b className={s.current()}>{current}</b>
      </span>
      {end ? <div className={s.end()}>{end}</div> : null}
    </header>
  );
}

export function TopbarIconButton({
  dotLabel,
  "aria-label": ariaLabel,
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  /** shows the unread dot and announces it, e.g. "3 unread" */
  dotLabel?: string;
}) {
  const s = topbar();
  // an aria-label replaces the content, so the unread state goes into it
  // (parentheses, not a comma: they read correctly in Arabic and English)
  const label = ariaLabel && dotLabel ? `${ariaLabel} (${dotLabel})` : ariaLabel;
  return (
    <button type="button" aria-label={label} className={s.iconButton({ className })} {...props}>
      {children}
      {dotLabel ? <span aria-hidden className={s.dot()} /> : null}
    </button>
  );
}
