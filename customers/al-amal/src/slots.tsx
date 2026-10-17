import type { SlotProps } from "@his/slots";
import { Ltr, Meta, Panel, PanelBody, PanelHeader, Status } from "@his/ui";

/*
 * What Al-Amal plugs into the core's outlets (customer.json → "slots").
 * The core never imports this file; compose wires it into Al-Amal's build only.
 */

/** searched for by scripts/verify-build.mjs — proves Al-Amal's own code reached the build */
export const AL_AMAL_SLOT_MARK = "his-al-amal-slot-module";

type L = { en: string; ar: string };

const T = {
  title: { en: "Loyalty programme", ar: "برنامج الولاء" },
  source: { en: "Al-Amal Rewards", ar: "مكافآت الأمل" },
  member: { en: "Member no.", ar: "رقم العضوية" },
  points: { en: "Points", ar: "النقاط" },
  none: { en: "Not a member", ar: "غير مشترك" },
} satisfies Record<string, L>;

// stands in for Al-Amal's own loyalty system, which a real build would call
const MEMBERS: Record<string, { memberNo: string; tier: L; points: string }> = {
  "40921": { memberNo: "AML-77812", tier: { en: "Gold", ar: "ذهبي" }, points: "2,340" },
};

/** Visit page side panel: the patient's standing in Al-Amal's loyalty programme. */
export function LoyaltyCard({ patientId, lang }: SlotProps["visit.side-panel"]) {
  const member = MEMBERS[patientId];
  return (
    <Panel data-module={AL_AMAL_SLOT_MARK}>
      <PanelHeader title={T.title[lang]} meta={<Meta>{T.source[lang]}</Meta>} />
      <PanelBody className="flex flex-col gap-2 text-sm">
        {member ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-3">{T.member[lang]}</span>
              <span className="font-medium">
                <Ltr>{member.memberNo}</Ltr>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-3">{T.points[lang]}</span>
              <span className="flex items-center gap-2 font-medium">
                <Ltr>{member.points}</Ltr>
                <Status state="done">{member.tier[lang]}</Status>
              </span>
            </div>
          </>
        ) : (
          <span className="text-ink-3">{T.none[lang]}</span>
        )}
      </PanelBody>
    </Panel>
  );
}
