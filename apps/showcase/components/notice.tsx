import { cn } from "@his/ui";
import { CircleCheck, Info, type LucideIcon, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A message box, the same idiom as the customer panel's (apps/customer-panel
 * components/fields.tsx), copied rather than imported across apps. Operations
 * stay neutral in this design system (colour is for clinical state), so a
 * problem is told by its icon, weight and border. No hooks: server and client
 * components can both render it.
 */
export function Notice({
  tone = "info",
  icon,
  title,
  children,
  id,
  region,
  className,
}: {
  tone?: "info" | "problem" | "done";
  /** replaces the tone's icon */
  icon?: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  id?: string;
  /**
   * A standing notice that is there on every page (the licence banner): a
   * named region a screen reader can find, instead of a live region that
   * would be announced again on every navigation.
   */
  region?: string;
  className?: string;
}) {
  const Icon = icon ?? (tone === "problem" ? TriangleAlert : tone === "done" ? CircleCheck : Info);
  return (
    <div
      id={id}
      role={region ? "region" : tone === "problem" ? "alert" : "status"}
      aria-label={region}
      className={cn(
        "flex gap-3 rounded-card border px-4 py-3 text-sm",
        tone === "problem" ? "border-ink-3 bg-surface-2 text-ink" : "border-line bg-surface text-ink-2",
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className={cn(tone === "problem" && "font-semibold")}>{title}</div>
        {children}
      </div>
    </div>
  );
}
