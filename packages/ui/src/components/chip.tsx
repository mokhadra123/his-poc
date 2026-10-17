import type { ComponentProps } from "react";
import { tv } from "../lib/tv";

/*
 * Pressed states carry a 3:1 border as well as a tint, so "on" is visible
 * without relying on a pale fill.
 */

/** A finding you can tick. A ticked finding is abnormal, so it reads as critical. */
export const chip = tv({
  base: [
    "h-chip max-w-full cursor-pointer rounded-chip border border-line bg-surface px-2.5 text-xs whitespace-nowrap text-ink-2",
    "max-sm:h-auto max-sm:min-h-chip max-sm:py-0.5 max-sm:whitespace-normal",
    "hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50",
    "aria-pressed:border-critical aria-pressed:bg-critical-soft aria-pressed:font-semibold aria-pressed:text-critical",
  ],
});

export function Chip({
  pressed,
  className,
  ...props
}: ComponentProps<"button"> & { pressed?: boolean }) {
  return <button type="button" aria-pressed={pressed} className={chip({ className })} {...props} />;
}

/** A filter you can switch on. Filters are actions, so they use the accent. */
export const pill = tv({
  base: [
    "inline-flex h-control-sm cursor-pointer items-center gap-1.5 rounded-ctl border border-line bg-surface px-3 text-sm text-ink-2",
    "hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5",
    // accent-text, not accent: it is darkened for pale brands, so the border keeps 3:1
    "aria-pressed:border-accent-text aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent-text",
  ],
});

export function Pill({
  pressed,
  className,
  ...props
}: ComponentProps<"button"> & { pressed?: boolean }) {
  return <button type="button" aria-pressed={pressed} className={pill({ className })} {...props} />;
}
