import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { tv } from "../lib/tv";

export const stat = tv({
  slots: {
    root: "rounded-card border border-card-line bg-surface px-pad py-pad-y shadow-card",
    label: "mb-2 text-xs text-ink-3",
    // value and unit are separate flex items, so the gap stays between them in RTL
    value: "inline-flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-3xl leading-none font-semibold tracking-tight",
    unit: "text-md font-normal tracking-normal text-ink-3",
    foot: "mt-2 flex items-center gap-1 text-xs text-ink-3 [&_svg]:size-3",
  },
});

type StatProps = {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  foot?: ReactNode;
  /**
   * Direction only. A business number going up or down is not a clinical
   * signal, so the trend stays neutral ink.
   */
  trend?: "up" | "down";
  className?: string;
};

export function Stat({ label, value, unit, foot, trend, className }: StatProps) {
  const s = stat();
  return (
    <div className={s.root({ className })}>
      <div className={s.label()}>{label}</div>
      <div className={s.value()}>
        <span>{value}</span>
        {unit ? (
          <span dir="auto" className={s.unit()}>
            {unit}
          </span>
        ) : null}
      </div>
      {foot ? (
        <div className={s.foot()}>
          {trend === "up" ? <ArrowUp aria-hidden /> : null}
          {trend === "down" ? <ArrowDown aria-hidden /> : null}
          {foot}
        </div>
      ) : null}
    </div>
  );
}
