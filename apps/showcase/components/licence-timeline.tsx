import { addDays, dayOf, daysBetween, type LicenceEvaluation } from "@his/licence";
import { cn } from "@his/ui";
import type { Dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { fill, formatDay } from "@/lib/licence-text";

type Stage = "valid" | "warning" | "grace" | "readOnly";

/*
 * valid → warning → grace → read-only, with today's place. Four equal steps,
 * not to scale: a year of "valid" would leave grace a sliver. Neutral on
 * purpose — the steps darken towards read-only, and the words carry the
 * meaning; licence state is operational, never a clinical colour.
 */
const FILL: Record<Stage, string> = {
  valid: "bg-surface-2",
  warning: "bg-line",
  grace: "bg-ink-3",
  readOnly: "bg-ink-2",
};

const STAGE_OF: Record<LicenceEvaluation["state"], Stage> = {
  valid: "valid",
  warning: "warning",
  grace: "grace",
  "read-only": "readOnly",
};

export function LicenceTimeline({
  evaluation,
  issuedAt,
  t,
  lang,
}: {
  evaluation: LicenceEvaluation;
  issuedAt: string;
  t: Dict["licence"]["page"];
  lang: Lang;
}) {
  const { timeline, today } = evaluation;
  const issued = dayOf(new Date(issuedAt));
  const stages: { key: Stage; from: string; to: string | null }[] = [
    { key: "valid", from: issued, to: addDays(timeline.warnFrom, -1) },
    // a licence shorter than its warning (or revoked early) starts warning on its first day
    { key: "warning", from: timeline.warnFrom > issued ? timeline.warnFrom : issued, to: timeline.endsOn },
    { key: "grace", from: addDays(timeline.endsOn, 1), to: timeline.graceEndsOn },
    { key: "readOnly", from: timeline.readOnlyFrom, to: null },
  ];
  const current = STAGE_OF[evaluation.state];
  const day = (d: string) => formatDay(d, lang);

  // where today sits inside its step; read-only has no end, so its first month fills it
  const position = (from: string, to: string | null) => {
    const span = to ? daysBetween(from, to) + 1 : 30;
    return Math.min(0.95, Math.max(0.05, (daysBetween(from, today) + 0.5) / span));
  };

  return (
    <ol aria-label={t.timeline} className="grid grid-cols-4 gap-1.5 max-sm:grid-cols-2 max-sm:gap-y-4">
      {stages.map(({ key, from, to }) => {
        // warnDays or graceDays of 0 leave a step with no days at all
        const empty = to !== null && to < from;
        const isCurrent = key === current;
        return (
          <li key={key} aria-current={isCurrent ? "step" : undefined} className="flex min-w-0 flex-col gap-1.5">
            <div aria-hidden className={cn("relative h-2.5 rounded-chip border border-line", FILL[key], empty && "opacity-40")}>
              {isCurrent ? (
                <span
                  className="absolute -top-1.5 h-5.5 w-1 -translate-x-1/2 rounded-full bg-ink ring-2 ring-surface rtl:translate-x-1/2"
                  style={{ insetInlineStart: `${position(from, to) * 100}%` }}
                />
              ) : null}
            </div>
            <div className={cn("text-sm", isCurrent ? "font-semibold text-ink" : "font-medium text-ink-2")}>
              {t.stages[key]}
            </div>
            <div className="text-xs text-ink-3">
              {empty ? t.skipped : to ? fill(t.range, { from: day(from), to: day(to) }) : fill(t.from, { date: day(from) })}
            </div>
            <div className="text-xs text-ink-3">{t.stageNotes[key]}</div>
            {isCurrent ? <div className="text-xs font-medium text-ink">{fill(t.today, { date: day(today) })}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}
