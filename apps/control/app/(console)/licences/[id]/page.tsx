import { button, Meta, PageHeader, Panel, PanelBody, PanelHeader } from "@his/ui";
import { formatLicenceFile } from "@his/licence";
import type { Product } from "@his/licence/api";
import { Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Code, Details, LicenceStatus, LinkButton, Page } from "@/components/bits";
import { CopyButton } from "@/components/client-bits";
import { ConsoleTopbar } from "@/components/console-topbar";
import { Notice } from "@/components/fields";
import { LicenceTimeline } from "@/components/timeline";
import { can, currentUser, get } from "@/lib/api";
import { DISPLAY, formatDay, formatTime, relativeDays } from "@/lib/format";
import { loadInstallation, loadLicence } from "@/lib/load";
import { RevokeLicence } from "./revoke";

export const metadata = { title: "Licence" };

export default async function LicencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ issued?: string; revoked?: string }>;
}) {
  const { id } = await params;
  const { issued, revoked } = await searchParams;
  const [user, licence, catalog] = await Promise.all([currentUser(), loadLicence(id), get<Product[]>("/api/catalog")]);
  const [installation, previous] = await Promise.all([
    loadInstallation(licence.installationId),
    licence.supersedes ? loadLicence(licence.supersedes) : Promise.resolve(null),
  ]);
  const issuer = can(user, "issuer");
  const active = licence.status === "active";
  const e = licence.evaluation;
  const names = new Map(catalog.map((p) => [p.id, p]));
  const fileText = formatLicenceFile(licence.file);
  const online = installation.connectivity === "online";

  const stateLine = !active
    ? licence.status === "revoked"
      ? `Revoked ${formatDay(licence.revokedAt)}: ${licence.revokeReason}`
      : "Replaced by a newer licence for the same installation"
    : e.state === "valid"
      ? `Valid until ${formatDay(e.timeline.endsOn)} (${relativeDays(e.daysLeft)})`
      : e.state === "warning"
        ? `Ends ${formatDay(e.timeline.endsOn)} (${relativeDays(e.daysLeft)}) — the hospital already sees a warning`
        : e.state === "grace"
          ? `Ended ${formatDay(e.timeline.endsOn)}; read-only from ${formatDay(e.timeline.readOnlyFrom)}`
          : `Read-only since ${formatDay(e.timeline.readOnlyFrom)} — new records are blocked`;

  return (
    <>
      <ConsoleTopbar
        crumbs={[
          { href: "/licences", label: "Licences" },
          { href: `/customers/${licence.customerId}`, label: licence.customerName.en },
        ]}
        current={installation.label}
      />
      <Page>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-3">
              Licence for {licence.customerName.en}
              <LicenceStatus display={licence.display} />
            </span>
          }
          subtitle={
            <>
              {installation.label} · <Code>{licence.id}</Code>
            </>
          }
          actions={
            <>
              {issuer && active ? (
                <LinkButton href={`/licences/new?installation=${licence.installationId}&renew=${licence.id}`}>
                  <RefreshCw aria-hidden />
                  Renew
                </LinkButton>
              ) : null}
              {issuer ? (
                <a href={`/licences/${licence.id}/file`} download className={button({ tone: active ? "primary" : "neutral" })}>
                  <Download aria-hidden />
                  Download licence file
                </a>
              ) : null}
            </>
          }
        />

        {issued ? (
          <Notice tone="done" title={licence.supersedes ? "Licence renewed and signed" : "Licence issued and signed"} className="mb-stack">
            {online
              ? "This installation is online: it picks the new licence up at its next heartbeat (within the hour), with no one touching the server. You can still download the file as a backup."
              : "This installation is offline: download the file and deliver it to the hospital. Their administrator installs it on HIS → Licence. Nothing needs restarting."}
          </Notice>
        ) : null}

        {revoked && licence.status === "revoked" ? (
          <Notice tone="done" title="Licence revoked" className="mb-stack">
            {previous?.status === "active" ? (
              <>
                The licence it replaced is current again:{" "}
                <Link href={`/licences/${previous.id}`} className="font-medium text-accent-text underline">
                  {previous.id.slice(0, 8)}, until {formatDay(previous.expiresOn)}
                </Link>
                {online ? ", and the installation gets it back at its next heartbeat." : "."}
              </>
            ) : online
              ? `The installation learns it at its next heartbeat. It keeps working for ${licence.graceDays} days of grace, then turns read-only on ${formatDay(
                  e.timeline.readOnlyFrom,
                )}. Issue a new licence to undo this.`
              : "The installation is offline and will not learn this: its file keeps working until it expires. No renewal will be issued for it."}
          </Notice>
        ) : null}

        <div className="grid items-start gap-stack xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-stack">
            <Panel>
              <PanelHeader level="h2" title="Where it stands" meta={<Meta>{DISPLAY[licence.display].label}</Meta>} />
              <PanelBody className="flex flex-col gap-5">
                <p className="text-md text-ink">{stateLine}</p>
                <LicenceTimeline evaluation={e} issuedAt={licence.issuedAt} inactive={active ? undefined : DISPLAY[licence.display].label} />
                <p className="text-xs text-ink-3">
                  Warning {licence.warnDays} days before the end, then {licence.graceDays} days of grace. Read-only keeps viewing,
                  printing and exporting; it never stops the hospital.
                </p>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader level="h2" title="Products" meta={<Meta>{licence.products.length ? licence.products.length : "core only"}</Meta>} />
              <PanelBody>
                {licence.products.length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {licence.products.map((p) => (
                      <li key={p} className="flex flex-col rounded-ctl border border-line px-3 py-2">
                        <span className="font-medium">{names.get(p)?.name.en ?? p}</span>
                        <span className="text-xs text-ink-3">
                          <Code className="text-xs">{p}</Code>
                          {names.get(p) ? ` · ${names.get(p)!.package}` : " · no longer in the catalog"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-3">Core only: no products beyond what every build has.</p>
                )}
              </PanelBody>
            </Panel>

            {/* the file carries what an installation's heartbeat presents: issuers only */}
            {issuer ? (
            <Panel>
                <PanelHeader
                  level="h2"
                  title="The file"
                  meta={<Meta>signed with {licence.kid}</Meta>}
                  actions={<CopyButton value={fileText} label="Copy" tone="ghost" />}
                />
                <PanelBody>
                  <pre className="max-h-96 overflow-auto rounded-ctl border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink-2">
                    {fileText}
                  </pre>
                  <p className="mt-2 text-xs text-ink-3">
                    Any change to it breaks the signature. Builds trust key <Code className="text-xs">{licence.kid}</Code> (fingerprint{" "}
                    <Code className="text-xs">{licence.fingerprint}</Code>).
                  </p>
                </PanelBody>
              </Panel>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-stack">
            <Panel>
              <PanelHeader level="h2" title="Details" />
              <PanelBody>
                <Details
                  items={[
                    ["Customer", <Link key="c" href={`/customers/${licence.customerId}`} className="hover:underline">{licence.customerName.en}</Link>],
                    [
                      "Installation",
                      <Link key="i" href={`/customers/${licence.customerId}/installations`} className="hover:underline">
                        {installation.label}
                      </Link>,
                    ],
                    ["Delivery", online ? "Online — by heartbeat" : "Offline — file delivered by hand"],
                    ["Issued", formatTime(licence.issuedAt)],
                    ["Issued by", licence.issuedBy],
                    ["Last valid day", formatDay(licence.expiresOn)],
                    ...(licence.supersedes
                      ? [["Replaces", <Link key="s" href={`/licences/${licence.supersedes}`} className="hover:underline"><Code>{licence.supersedes.slice(0, 8)}</Code></Link>] as [string, ReactNode]]
                      : []),
                    ...(licence.supersededBy
                      ? [["Replaced by", <Link key="b" href={`/licences/${licence.supersededBy}`} className="hover:underline"><Code>{licence.supersededBy.slice(0, 8)}</Code></Link>] as [string, ReactNode]]
                      : []),
                    ...(licence.note ? [["Note", licence.note] as [string, string]] : []),
                  ]}
                />
              </PanelBody>
            </Panel>

            {issuer && active ? (
              <Panel>
                <PanelHeader level="h2" title="Revoke" />
                <PanelBody>
                  <RevokeLicence
                    id={licence.id}
                    online={online}
                    graceDays={licence.graceDays}
                    replaces={previous ? { id: previous.id, expiresOn: previous.expiresOn } : null}
                  />
                </PanelBody>
              </Panel>
            ) : null}
          </div>
        </div>
      </Page>
    </>
  );
}
