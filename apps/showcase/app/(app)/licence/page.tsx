import type { LicenceState } from "@his/licence";
import { Ltr, PageHeader, Panel, PanelBody, PanelHeader, Status } from "@his/ui";
import { Clock, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { invalidReason } from "@/components/licence-banner";
import { LicenceInstallForm } from "@/components/licence-install-form";
import { LicenceTimeline } from "@/components/licence-timeline";
import { Notice } from "@/components/notice";
import { Page, PageTopbar } from "@/components/page-parts";
import { getDict, getLang } from "@/lib/i18n";
import { getLicence, readState } from "@/lib/licence";
import { countDays, fill, formatDay, formatMoment } from "@/lib/licence-text";
import { CUSTOMER, PRODUCTS } from "@/lib/products.generated";

/* operational, so <Status>: someone must act once the licence has ended */
const STATUS: Record<LicenceState, "done" | "pending" | "attention"> = {
  valid: "done",
  warning: "pending",
  grace: "attention",
  "read-only": "attention",
};

function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-md">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-ink-3">{item.label}</dt>
          <dd className="min-w-0 font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function LicencePage() {
  const lang = await getLang();
  const t = await getDict();
  const l = t.licence;
  const p = l.page;
  const check = getLicence();
  const day = (d: string) => formatDay(d, lang);
  const days = (n: number) => countDays(n, l.days, lang);

  const install = (
    <Panel>
      <PanelHeader title={l.install.title} />
      <PanelBody>
        <LicenceInstallForm t={l.install} />
      </PanelBody>
    </Panel>
  );

  let body: ReactNode;
  if (!check.licensing) {
    body = (
      <Notice title={p.devTitle}>
        <p>{p.devBody}</p>
        <pre dir="ltr" className="mt-1 overflow-x-auto rounded-ctl border border-line bg-surface-2 p-3 text-start font-mono text-xs text-ink-2">
          {`HIS_CUSTOMER=${CUSTOMER.id} HIS_LICENCE=<licence.json> node scripts/compose.mjs`}
        </pre>
      </Notice>
    );
  } else if (check.status !== "ok") {
    body = (
      <div className="grid items-start gap-stack lg:grid-cols-[3fr_2fr]">
        <Notice tone="problem" icon={Lock} title={check.status === "missing" ? p.missingTitle : p.invalidTitle}>
          {check.status === "invalid" ? <p>{invalidReason(check, l)}</p> : null}
          <p>{p.readOnlyBody}</p>
          {check.status === "invalid" ? (
            <p dir="ltr" className="text-start font-mono text-xs text-ink-2">
              {check.reason}
            </p>
          ) : null}
        </Notice>
        {install}
      </div>
    );
  } else {
    const { payload, evaluation: e } = check;
    const state = readState();
    const server = process.env.HIS_LICENCE_SERVER_URL?.replace(/\/+$/, "");
    const name = (id: string) => PRODUCTS.find((x) => x.id === id)?.name[lang];
    const products = [
      ...payload.products.map((id) => ({ id, built: !check.notBuilt.includes(id), licensed: true })),
      ...check.notLicensed.map((id) => ({ id, built: true, licensed: false })),
    ];

    body = (
      <div className="grid items-start gap-stack lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-stack">
          {e.clockAdjusted ? <Notice icon={Clock} title={fill(p.clock, { date: day(e.today) })} /> : null}
          <Panel>
            <PanelHeader title={p.details} meta={<Status state={STATUS[e.state]}>{p.states[e.state]}</Status>} />
            <PanelBody>
              <Facts
                items={[
                  {
                    label: p.customer,
                    value: (
                      <>
                        {payload.customerName[lang]} <span className="font-normal text-ink-3">(<Ltr>{payload.customerId}</Ltr>)</span>
                      </>
                    ),
                  },
                  { label: p.installation, value: <Ltr>{payload.installationId}</Ltr> },
                  { label: p.licenceId, value: <Ltr>{payload.licenceId}</Ltr> },
                  { label: p.issued, value: formatMoment(payload.issuedAt, lang) },
                  { label: p.lastDay, value: day(payload.expiresOn) },
                  ...(e.revokedOn ? [{ label: p.revoked, value: day(e.revokedOn) }] : []),
                  { label: p.warning, value: fill(p.warningValue, { days: days(payload.warnDays) }) },
                  { label: p.grace, value: fill(p.graceValue, { days: days(payload.graceDays) }) },
                ]}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title={p.timeline} />
            <PanelBody>
              <LicenceTimeline evaluation={e} issuedAt={payload.issuedAt} t={p} lang={lang} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title={p.products} />
            <PanelBody className="flex flex-col gap-3">
              <p className="text-sm text-ink-3">{p.productsNote}</p>
              {products.length ? (
                <ul className="flex flex-col">
                  {products.map(({ id, built, licensed }) => (
                    <li
                      key={id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-2 py-2.5 last:border-b-0"
                    >
                      <span className="text-md font-medium">{name(id) ?? <Ltr>{id}</Ltr>}</span>
                      {name(id) ? (
                        <span className="text-xs text-ink-3">
                          <Ltr>{id}</Ltr>
                        </span>
                      ) : null}
                      <Status state={built && licensed ? "done" : "attention"} className="ms-auto">
                        {!licensed ? p.notLicensed : built ? p.inBuild : p.notBuilt}
                      </Status>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-md">{p.coreOnly}</p>
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-stack">
          {install}
          <Panel>
            <PanelHeader title={p.heartbeat} />
            <PanelBody className="flex flex-col gap-3 text-md">
              {server ? (
                <p>
                  {p.online} <Ltr>{server}</Ltr>
                </p>
              ) : (
                <p className="text-ink-2">{p.offline}</p>
              )}
              {state.lastHeartbeat ? (
                <Facts
                  items={[
                    {
                      label: p.lastBeat,
                      value: (
                        <time dateTime={state.lastHeartbeat.at}>{formatMoment(state.lastHeartbeat.at, lang)}</time>
                      ),
                    },
                    {
                      label: p.state,
                      value: (
                        <span className="flex flex-col items-start gap-1">
                          <Status state={state.lastHeartbeat.status === "error" ? "attention" : "done"}>
                            {p.beat[state.lastHeartbeat.status]}
                          </Status>
                          <span dir="auto" className="text-sm font-normal text-ink-3">
                            {state.lastHeartbeat.message}
                          </span>
                        </span>
                      ),
                    },
                  ]}
                />
              ) : server ? (
                <p className="text-ink-3">{p.noBeat}</p>
              ) : null}
            </PanelBody>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageTopbar crumbs={[t.shell.sections.setup]} current={l.title} t={t.shell} />
      {/* this page shows the licence state itself, so no banner above it */}
      <Page licenceBanner={false}>
        <PageHeader title={l.title} subtitle={l.subtitle} />
        {body}
      </Page>
    </>
  );
}
