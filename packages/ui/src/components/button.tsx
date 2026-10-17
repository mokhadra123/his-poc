import type { ComponentProps } from "react";
import { tv, type VariantProps } from "../lib/tv";

export const button = tv({
  base: [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap",
    "rounded-ctl border font-medium transition-colors duration-100",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  variants: {
    tone: {
      neutral: "border-line bg-surface text-ink hover:bg-surface-2",
      /** the accent is spent only on what you can act on */
      primary:
        "border-accent-edge bg-accent text-accent-ink hover:bg-accent-hover",
      ghost: "border-transparent bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
    },
    size: {
      md: "h-control px-3.5 text-md",
      sm: "h-control-sm px-2.5 text-sm",
    },
    iconOnly: { true: "px-0" },
  },
  compoundVariants: [
    { iconOnly: true, size: "md", class: "w-control" },
    { iconOnly: true, size: "sm", class: "w-control-sm" },
  ],
  defaultVariants: { tone: "neutral", size: "md" },
});

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof button>;

export function Button({ tone, size, iconOnly, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={button({ tone, size, iconOnly, className })} {...props} />;
}
