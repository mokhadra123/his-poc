import type { ReactNode } from "react";
import { tv } from "../lib/tv";
import { Avatar } from "./misc";

export const patientBanner = tv({
  slots: {
    root: "mb-stack flex flex-wrap items-center gap-x-5 gap-y-3 rounded-card border border-card-line bg-surface px-4.5 py-3.5 shadow-card",
    id: "flex min-w-0 items-center gap-3",
    name: "text-xl font-semibold tracking-tight text-heading-ink",
    altName: "ms-1 text-lg font-normal text-ink-3",
    meta: "mt-0.5 text-sm text-ink-3",
    alerts: "flex flex-wrap items-center gap-1.5",
    facts: "ms-auto flex flex-wrap gap-x-6.5 gap-y-2",
    factLabel: "text-xs text-ink-3",
    factValue: "mt-0.5 text-md font-medium",
  },
});

type PatientBannerProps = {
  initials: string;
  name: ReactNode;
  /** the screen's main heading on a patient record: h1; inside another page: h2 */
  nameAs?: "h1" | "h2";
  /** the name in the other script */
  altName?: ReactNode;
  /** BCP 47 code of altName, e.g. "ar" */
  altNameLang?: string;
  meta: ReactNode;
  /** clinical signals that follow the patient everywhere: allergies, critical results */
  alerts?: ReactNode;
  facts?: { label: ReactNode; value: ReactNode }[];
};

export function PatientBanner({
  initials,
  name,
  nameAs: Name = "h2",
  altName,
  altNameLang,
  meta,
  alerts,
  facts,
}: PatientBannerProps) {
  const s = patientBanner();
  return (
    <div className={s.root()}>
      <div className={s.id()}>
        <Avatar size="lg" aria-hidden>
          {initials}
        </Avatar>
        <div>
          <Name className={s.name()}>
            {name}
            {altName ? (
              <>
                {" "}
                <bdi lang={altNameLang} className={s.altName()}>
                  {altName}
                </bdi>
              </>
            ) : null}
          </Name>
          <div className={s.meta()}>{meta}</div>
        </div>
      </div>
      {alerts ? <div className={s.alerts()}>{alerts}</div> : null}
      {facts?.length ? (
        <dl className={s.facts()}>
          {facts.map((f, i) => (
            <div key={i}>
              <dt className={s.factLabel()}>{f.label}</dt>
              <dd className={s.factValue()}>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
