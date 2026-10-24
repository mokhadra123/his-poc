import { cn } from "@his/ui";
import { addDays, daysBetween, type LicenceEvaluation } from "@his/licence";
import { formatDay } from "@/lib/format";

/*
 * Where a licence is on its road: valid → expiring → grace → read-only, with
 * today marked. Neutral by design (a licence is not a clinical state): the
 * segment you are in is drawn in full ink, the ones behind you in a lighter
 * ink, the ones ahead as outlines. Widths are fixed, not to scale, so the
 * short periods stay readable next to a year of validity.
 */

type Segment = { key: string; label: string; from: string; to: string | null; grow: string };

export function LicenceTimeline({
  evaluation,
  issuedAt,
  inactive,
  compact,
}: {
  evaluation: LicenceEvaluation;
  issuedAt: string;
  /** superseded or revoked: drawn, but no "today" */
  inactive?: string;
  compact?: boolean;
}) {
  const t = evaluation.timeline;
  const issued = issuedAt.slice(0, 10);
  // a short licence, or one revoked early, never had some periods: drop them
  // rather than draw a range that ends before it starts
  const segments: Segment[] = (
    [
      { key: "valid", label: "Valid", from: issued, to: addDays(t.warnFrom, -1), grow: "grow-[3]" },
      { key: "warning", label: "Expiring", from: t.warnFrom > issued ? t.warnFrom : issued, to: t.endsOn, grow: "grow-[1.4]" },
      { key: "grace", label: "Grace", from: addDays(t.endsOn, 1), to: t.graceEndsOn, grow: "grow" },
      { key: "read-only", label: "Read-only", from: t.readOnlyFrom, to: null, grow: "grow" },
    ] satisfies Segment[]
  ).filter((s) => s.to === null || s.to >= s.from);
  const current = Math.max(
    0,
    segments.findIndex((s) => s.key === evaluation.state),
  );

  // how far through the current segment today is (0–100)
  const seg = segments[current];
  let position = 50;
  if (seg.to) {
    const total = Math.max(1, daysBetween(seg.from, seg.to) + 1);
    position = Math.min(96, Math.max(4, (daysBetween(seg.from, evaluation.today) / total) * 100));
  } else {
    position = 12;
  }

  return (
    <div className={cn("flex w-full gap-1", compact ? "min-w-48" : "pt-7")} role="img" aria-label={describe(evaluation, inactive)}>
      {segments.map((s, i) => {
        const state = inactive ? "future" : i < current ? "past" : i === current ? "now" : "future";
        return (
          <div key={s.key} className={cn("relative flex min-w-0 basis-0 flex-col gap-1.5", s.grow)}>
            {state === "now" && !compact ? (
              <span
                aria-hidden
                className="absolute bottom-full mb-1 flex -translate-x-1/2 flex-col items-center rtl:translate-x-1/2"
                style={{ insetInlineStart: `${position}%` }}
              >
                <span className="rounded-chip bg-ink px-1.5 text-2xs leading-4 font-semibold whitespace-nowrap text-surface">Today</span>
                <span className="h-1.5 w-px bg-ink" />
              </span>
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative h-2 rounded-full border",
                state === "past" && "border-ink-3 bg-ink-3",
                state === "now" && "border-ink bg-surface-2",
                state === "future" && "border-line bg-surface-2",
              )}
            >
              {state === "now" ? (
                <>
                  {/* the part of the current period already behind us */}
                  <span className="absolute inset-y-0 start-0 rounded-full bg-ink" style={{ width: `${position}%` }} />
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink rtl:translate-x-1/2"
                    style={{ insetInlineStart: `${position}%` }}
                  />
                </>
              ) : null}
            </span>
            {compact ? null : (
              <span className="flex min-w-0 flex-col">
                <span className={cn("truncate text-xs", state === "now" ? "font-semibold text-ink" : "text-ink-3")}>{s.label}</span>
                <span className="truncate text-2xs text-ink-3">
                  {s.to ? `${formatDay(s.from)} – ${formatDay(s.to)}` : `from ${formatDay(s.from)}`}
                </span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function describe(e: LicenceEvaluation, inactive?: string) {
  const t = e.timeline;
  const road = `Valid until ${formatDay(addDays(t.warnFrom, -1))}, expiring until ${formatDay(t.endsOn)}, grace until ${formatDay(
    t.graceEndsOn,
  )}, read-only from ${formatDay(t.readOnlyFrom)}.`;
  return inactive ? `${inactive}. ${road}` : `Today: ${e.state}. ${road}`;
}
