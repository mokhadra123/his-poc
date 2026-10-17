import type { ComponentProps, ReactNode } from "react";
import { tv } from "../lib/tv";

export const table = tv({
  slots: {
    // relative: sr-only content inside cells stays inside this scroller
    wrap: "relative overflow-x-auto focus-visible:outline-offset-[-2px] print:overflow-visible",
    root: "w-full border-collapse text-md",
    th: [
      "h-(--thead-h) border-b border-line bg-thead px-cell text-start whitespace-nowrap text-thead-ink",
      "text-(length:--thead-fs) [font-weight:var(--thead-weight)] print:whitespace-normal",
    ],
    tr: "hover:bg-row-hover",
    // nowrap keeps a compact row one line tall; the wrapper scrolls instead
    td: "h-row border-b border-line-2 px-cell py-1 align-middle whitespace-nowrap text-cell-ink print:whitespace-normal [tr:last-child>&]:border-b-0",
  },
  variants: {
    tone: {
      default: {},
      dim: { td: "text-ink-3" },
      id: { td: "text-sm text-ink-3 print:whitespace-nowrap" },
      /** long free text that should wrap */
      wrap: { td: "whitespace-normal" },
    },
  },
  defaultVariants: { tone: "default" },
});

/**
 * `label` makes the horizontal scroller a named, keyboard-focusable region,
 * so a wide table can be scrolled without a mouse.
 */
export function Table({ label, className, ...props }: ComponentProps<"table"> & { label?: string }) {
  const s = table();
  return (
    <div
      className={s.wrap()}
      {...(label ? { role: "region", "aria-label": label, tabIndex: 0 } : {})}
    >
      <table className={s.root({ className })} {...props} />
    </div>
  );
}

export function Th({ className, scope = "col", ...props }: ComponentProps<"th">) {
  return <th scope={scope} className={table().th({ className })} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={table().tr({ className })} {...props} />;
}

export function Td({
  tone,
  className,
  ...props
}: ComponentProps<"td"> & { tone?: "default" | "dim" | "id" | "wrap" }) {
  return <td className={table({ tone }).td({ className })} {...props} />;
}

/**
 * Bilingual name cell. Compact density keeps the second script on the same
 * line so a 36px row stays one line tall; comfortable density stacks it.
 * The second name carries its own lang, so screen readers switch voice.
 */
export function NameCell({
  primary,
  secondary,
  secondaryLang,
}: { primary: ReactNode } & (
  | { secondary?: undefined; secondaryLang?: never }
  | {
      secondary: ReactNode;
      /** BCP 47 code of the second name, e.g. "ar" — picks the right font and voice */
      secondaryLang: string;
    }
)) {
  return (
    <>
      <span className="font-medium">{primary}</span>
      {secondary ? (
        <>
          {" "}
          <bdi lang={secondaryLang} className="ms-1 text-sm text-ink-3 comfortable:ms-0 comfortable:block">
            {secondary}
          </bdi>
        </>
      ) : null}
    </>
  );
}
