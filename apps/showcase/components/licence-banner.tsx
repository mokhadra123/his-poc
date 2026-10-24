import { CalendarClock, Clock, Lock, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Notice } from "@/components/notice";
import { type Dict, getDict, getLang } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import { getLicence, type LicenceCheck } from "@/lib/licence";
import { countDays, fill, formatDay, LICENCE_NOTICE_ID, ltr } from "@/lib/licence-text";

type T = Dict["licence"];

/** Why the installed licence is not accepted, in words (ids kept left-to-right). */
export function invalidReason(check: Extract<LicenceCheck, { status: "invalid" }>, t: T): string {
  return fill(t.reasons[check.code], { id: ltr(check.detail ?? "") });
}

type Message = { problem: boolean; icon: LucideIcon; title: string; more: string[]; link: "install" | "details" };

/** What the banner says, or null when there is nothing to say (valid, or licensing off). */
function describe(check: LicenceCheck, t: T, lang: Lang): Message | null {
  if (!check.licensing) return null;
  if (check.status === "missing") return { problem: true, icon: Lock, title: t.banner.missing, more: [], link: "install" };
  if (check.status === "invalid") {
    return { problem: true, icon: Lock, title: fill(t.banner.invalid, { reason: invalidReason(check, t) }), more: [], link: "install" };
  }

  const e = check.evaluation;
  const day = (d: string) => formatDay(d, lang);
  const days = (n: number) => countDays(n, t.days, lang);
  const more: string[] = [];
  // the titles already say when it ended (the revocation day, when that came first)
  if (e.revokedOn && e.state !== "valid") more.push(t.banner.revoked);
  // a turned-back clock is worth knowing even while the licence is valid
  if (e.clockAdjusted) more.push(fill(t.banner.clock, { date: day(e.today) }));

  switch (e.state) {
    case "warning":
      return {
        problem: false,
        icon: Clock,
        title:
          e.daysLeft === 0
            ? fill(t.banner.warningToday, { date: day(e.timeline.endsOn) })
            : fill(t.banner.warning, { days: days(e.daysLeft), date: day(e.timeline.endsOn) }),
        more: [fill(t.banner.warningNext, { grace: days(check.payload.graceDays) }), ...more],
        link: "install",
      };
    case "grace":
      return {
        problem: true,
        icon: CalendarClock,
        title:
          e.graceDaysLeft === 0
            ? fill(t.banner.graceLast, { date: day(e.timeline.endsOn) })
            : fill(t.banner.grace, { date: day(e.timeline.endsOn), days: days(e.graceDaysLeft) }),
        more,
        link: "install",
      };
    case "read-only":
      return { problem: true, icon: Lock, title: fill(t.banner.readOnly, { date: day(e.timeline.readOnlyFrom) }), more, link: "install" };
    default: {
      const [first, ...rest] = more;
      return first ? { problem: false, icon: Clock, title: first, more: rest, link: "details" } : null;
    }
  }
}

/**
 * The licence banner at the top of every app page (components/page-parts.tsx
 * → Page), below the sticky topbar. Neutral on purpose: licence state is
 * operational, not clinical, so it is told by icon, weight and words — never
 * by a clinical colour. Disabled actions point at it (LICENCE_NOTICE_ID).
 */
export async function LicenceBanner() {
  const check = getLicence();
  if (!check.licensing) return null;
  const lang = await getLang();
  const t = (await getDict()).licence;
  const message = describe(check, t, lang);
  if (!message) return null;

  return (
    <Notice
      id={LICENCE_NOTICE_ID}
      region={t.banner.label}
      tone={message.problem ? "problem" : "info"}
      icon={message.icon}
      title={message.title}
      className="mb-stack print:hidden"
    >
      {message.more.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p>
        <Link href="/licence" className="font-medium text-accent-text underline">
          {message.link === "install" ? t.banner.install : t.banner.details}
        </Link>
      </p>
    </Notice>
  );
}
