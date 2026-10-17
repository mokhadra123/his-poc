import type { ComponentProps, ReactNode } from "react";
import { tv } from "../lib/tv";

/* A slot recipe — the Tailwind equivalent of Chakra's defineSlotRecipe. */
export const panel = tv({
  slots: {
    root: "flex flex-col overflow-hidden rounded-card border border-card-line bg-surface shadow-card print:overflow-visible",
    // wraps on narrow screens: actions drop under the title instead of overflowing
    head: "flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line px-pad py-pad-y",
    title: "text-lg font-semibold",
    actions: "ms-auto flex items-center gap-2",
    body: "p-pad",
  },
  variants: {
    flush: { true: { body: "p-0" } },
  },
});

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={panel().root({ className })} {...props} />;
}

type PanelHeaderProps = Omit<ComponentProps<"div">, "title"> & {
  title: ReactNode;
  /** heading level in the page outline; panels inside a section use h3 */
  level?: "h2" | "h3";
  /** sits beside the title: a count, a timestamp */
  meta?: ReactNode;
  /** pushed to the end of the row, whatever the direction */
  actions?: ReactNode;
};

export function PanelHeader({ title, level: Heading = "h2", meta, actions, className, ...props }: PanelHeaderProps) {
  const s = panel();
  return (
    <div className={s.head({ className })} {...props}>
      <Heading className={s.title()}>{title}</Heading>
      {meta}
      {actions ? <div className={s.actions()}>{actions}</div> : null}
    </div>
  );
}

export function PanelBody({ flush, className, ...props }: ComponentProps<"div"> & { flush?: boolean }) {
  return <div className={panel({ flush }).body({ className })} {...props} />;
}
