import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { tv } from "../lib/tv";

/*
 * Tabs here are section navigation: each tab is a link to a sub-page of the
 * record (in HIS these are routes), so the pattern is a labelled <nav> of
 * links with aria-current="page" — not an ARIA tablist, which would need
 * in-page panels and arrow-key handling.
 */
export const tabs = tv({
  slots: {
    root: "mb-stack flex flex-wrap items-end gap-x-5 border-b border-line",
    list: "flex flex-wrap items-end gap-x-5",
    tab: [
      "-mb-px cursor-pointer border-b-2 border-transparent pb-2.5 text-md whitespace-nowrap text-ink-3",
      // the underline marks state, not an action: accent-text, not the accent fill
      "hover:text-ink aria-[current]:border-accent-text aria-[current]:font-medium aria-[current]:text-accent-text",
    ],
    end: "ms-auto self-center pb-2",
  },
});

export function Tabs({
  children,
  end,
  className,
  ...props
}: ComponentProps<"nav"> & { "aria-label": string; end?: ReactNode }) {
  const s = tabs();
  return (
    <div className={s.root({ className })}>
      <nav className={s.list()} {...props}>
        {children}
      </nav>
      {end ? <div className={s.end()}>{end}</div> : null}
    </div>
  );
}

export function Tab({ current, className, ...props }: ComponentProps<"a"> & { current?: boolean }) {
  return <a aria-current={current ? "page" : undefined} className={tabs().tab({ className })} {...props} />;
}

export const steps = tv({
  slots: {
    list: "isolate flex flex-col gap-0.5",
    step: [
      "relative flex cursor-pointer focus-visible:z-10 items-center gap-2.5 rounded-ctl px-3 py-2 text-start text-md text-ink-2",
      "hover:bg-surface-2 aria-[current]:bg-accent-soft aria-[current]:font-medium aria-[current]:text-accent-text",
    ],
    num: "grid size-5 shrink-0 place-items-center rounded-full border text-2xs [&_svg]:size-3 [&_svg]:stroke-[2.6]",
  },
  variants: {
    state: {
      todo: { num: "border-line bg-surface text-ink-3" },
      current: { num: "border-step-current bg-step-current text-step-current-ink" },
      // completion is workflow, not clinical state: neutral by default, the check carries it
      done: { num: "border-transparent bg-step-done text-step-done-ink" },
    },
  },
});

export function Steps({ className, ...props }: ComponentProps<"nav"> & { "aria-label": string }) {
  return <nav className={steps().list({ className })} {...props} />;
}

type StepProps = ComponentProps<"button"> & { index: number } & (
    | { state?: "todo" | "current"; doneLabel?: never }
    | {
        state: "done";
        /** translated, e.g. "done" — announced in place of the check */
        doneLabel: string;
      }
  );

export function Step({ index, state = "todo", doneLabel, className, children, ...props }: StepProps) {
  const s = steps({ state });
  return (
    <button
      type="button"
      aria-current={state === "current" ? "step" : undefined}
      className={s.step({ className })}
      {...props}
    >
      <span className={s.num()}>
        {state === "done" ? (
          <>
            <Check aria-hidden />
            <span className="sr-only">{doneLabel}: </span>
          </>
        ) : (
          index
        )}
      </span>
      {children}
    </button>
  );
}
