import type { LicencePayload } from "./payload.ts";

/*
 * Where a licence stands on a given day. A hospital never stops:
 *
 *   valid ──(warnDays before expiry)──▶ warning ──(expiresOn)──▶ grace ──(graceDays)──▶ read-only
 *
 * read-only keeps viewing, printing and exporting, and refuses new records.
 * Days are UTC calendar days; expiresOn is the last fully valid day.
 */

export type LicenceState = "valid" | "warning" | "grace" | "read-only";

export type LicenceTimeline = {
  /** first day of the warning */
  warnFrom: string;
  /** last fully valid day (expiresOn, or the revocation day when that is earlier) */
  endsOn: string;
  /** last day of grace */
  graceEndsOn: string;
  /** first read-only day */
  readOnlyFrom: string;
};

export type LicenceEvaluation = {
  state: LicenceState;
  readOnly: boolean;
  /** the UTC day the evaluation used — see clockAdjusted */
  today: string;
  /** days from today to endsOn: 0 on the last day, negative after it */
  daysLeft: number;
  /** grace days left after today, while in grace */
  graceDaysLeft: number;
  timeline: LicenceTimeline;
  /**
   * The system clock was earlier than a time this installation had already
   * seen (or than the licence's own issue time), so the later time was used.
   * Turning the clock back does not extend a licence.
   */
  clockAdjusted: boolean;
  revokedOn: string | null;
};

const DAY_MS = 86_400_000;

export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return dayOf(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** clock tolerance before a later "seen" time wins over the system clock */
const SKEW_MS = 5 * 60_000;

export function evaluateLicence(
  payload: Pick<LicencePayload, "issuedAt" | "expiresOn" | "warnDays" | "graceDays">,
  {
    now = new Date(),
    seen = [],
    revokedOn = null,
  }: {
    now?: Date;
    /** times this installation has already seen (its high-water mark), ISO strings or Dates */
    seen?: (string | Date | null | undefined)[];
    /** the control plane revoked the licence on this day (learned by heartbeat) */
    revokedOn?: string | null;
  } = {},
): LicenceEvaluation {
  const floor = [payload.issuedAt, ...seen]
    .map((t) => (t == null ? Number.NaN : new Date(t).getTime()))
    .filter((t) => !Number.isNaN(t));
  const latestSeen = Math.max(0, ...floor);
  const clockAdjusted = latestSeen > now.getTime() + SKEW_MS;
  const effective = new Date(Math.max(now.getTime(), latestSeen));
  const today = dayOf(effective);

  const endsOn = revokedOn && revokedOn < payload.expiresOn ? revokedOn : payload.expiresOn;
  const timeline: LicenceTimeline = {
    warnFrom: addDays(endsOn, -payload.warnDays + 1),
    endsOn,
    graceEndsOn: addDays(endsOn, payload.graceDays),
    readOnlyFrom: addDays(endsOn, payload.graceDays + 1),
  };

  const daysLeft = daysBetween(today, endsOn);
  const state: LicenceState =
    today < timeline.warnFrom ? "valid" : today <= endsOn ? "warning" : today <= timeline.graceEndsOn ? "grace" : "read-only";

  return {
    state,
    readOnly: state === "read-only",
    today,
    daysLeft,
    graceDaysLeft: state === "grace" ? daysBetween(today, timeline.graceEndsOn) : 0,
    timeline,
    clockAdjusted,
    revokedOn: revokedOn ?? null,
  };
}
