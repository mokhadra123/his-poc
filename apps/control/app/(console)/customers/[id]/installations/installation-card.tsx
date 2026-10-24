"use client";

import { Button, cn, Meta, Panel, PanelBody, PanelHeader, Status } from "@his/ui";
import type { Installation, Release } from "@his/licence/api";
import { FilePlus2, Pencil, PowerOff, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { type ActionResult, addInstallation, retireInstallation, updateInstallation } from "@/app/actions";
import { BuildReleaseButton } from "../../../releases/build-release-button";
import { Code, Details, LicenceStatus, LinkButton, ProductTags } from "@/components/bits";
import { CopyButton } from "@/components/client-bits";
import { ActionMessage, ChoiceCards, Notice, SubmitButton, TextField } from "@/components/fields";
import { ago, formatBytes, formatDay, formatTime, RELEASE, relativeDays } from "@/lib/format";

const ENVIRONMENTS = [
  { value: "production" as const, label: "Production", help: "Where the hospital works" },
  { value: "test" as const, label: "Test", help: "Training or acceptance copy" },
];
const CONNECTIVITY = [
  { value: "online" as const, label: "Online", help: "Reports in; renewals arrive by themselves" },
  { value: "offline" as const, label: "Offline", help: "Air-gapped; licence files are delivered and uploaded" },
];

function InstallationFields({
  installation,
  fields,
  values = {},
}: {
  installation?: Installation;
  fields: Record<string, string>;
  /** what was typed into a refused form */
  values?: Record<string, string>;
}) {
  return (
    <>
      <TextField
        label="Name"
        name="label"
        required
        maxLength={80}
        defaultValue={values.label ?? installation?.label}
        placeholder="Main hospital"
        error={fields.label}
      />
      <ChoiceCards name="environment" legend="Environment" value={(values.environment as Installation["environment"]) ?? installation?.environment ?? "production"} options={ENVIRONMENTS} />
      <ChoiceCards name="connectivity" legend="Connectivity" value={(values.connectivity as Installation["connectivity"]) ?? installation?.connectivity ?? "offline"} options={CONNECTIVITY} />
    </>
  );
}

export function AddInstallation({ customerId }: { customerId: string }) {
  const [result, action] = useActionState<ActionResult, FormData>(addInstallation.bind(null, customerId), null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (result?.ok) form.current?.reset();
  }, [result]);
  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
      <InstallationFields fields={result && !result.ok ? result.fields : {}} values={result && !result.ok ? result.values : {}} />
      <ActionMessage result={result} />
      <SubmitButton tone="primary" pendingText="Adding…" className="self-start">
        Add installation
      </SubmitButton>
    </form>
  );
}

/** One deployment: its licence, whether it reports in, and what you can do with it. */
/**
 * The latest build of this installation, and the button that starts a new
 * one from its active licence (the release page then follows the build).
 */
function ReleaseRow({ installationId, latest, issuer }: { installationId: string; latest: Release | null; issuer: boolean }) {
  const r = latest ? RELEASE[latest.status] : null;
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-ctl border border-line p-3 text-sm">
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        <span className="font-medium text-ink">Release</span>
        {latest && r ? (
          <>
            <Status state={r.state} title={latest.error ?? undefined}>
              {r.label}
            </Status>
            <span className="text-ink-3">
              {latest.status === "running"
                ? latest.step
                : [latest.version, formatTime(latest.finishedAt ?? latest.createdAt), latest.status === "succeeded" ? formatBytes(latest.bytes) : null]
                    .filter(Boolean)
                    .join(" · ")}
            </span>
            <Link href={`/releases/${latest.id}`} className="font-medium text-accent-text underline-offset-2 hover:underline">
              Open release
            </Link>
          </>
        ) : (
          <span className="text-ink-3">Not built yet — build one to get the bundle the hospital installs.</span>
        )}
      </div>
      {issuer ? <BuildReleaseButton installationId={installationId} disabled={latest?.status === "running"} className="ms-auto" /> : null}
    </div>
  );
}

export function InstallationCard({
  installation: i,
  issuer,
  flat,
  releases = [],
}: {
  installation: Installation;
  issuer: boolean;
  flat?: boolean;
  /** this installation's releases, newest first */
  releases?: Release[];
}) {
  const [editing, setEditing] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [retireResult, setRetireResult] = useState<ActionResult>(null);
  const [retiring, startRetire] = useTransition();
  const [editResult, editAction] = useActionState<ActionResult, FormData>(updateInstallation.bind(null, i.id), null);
  useEffect(() => {
    if (editResult?.ok) setEditing(false);
  }, [editResult]);

  const licence = i.licence;
  const hb = i.lastHeartbeat;
  const issueHref = licence ? `/licences/new?installation=${i.id}&renew=${licence.id}` : `/licences/new?installation=${i.id}`;

  const body = (
    <div className="flex flex-col gap-4">
      <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
        <Details
          items={[
            [
              "Installation id",
              <span key="id" className="flex flex-wrap items-center gap-2">
                <Code className="text-xs break-all">{i.id}</Code>
                <CopyButton value={i.id} label="Copy" tone="ghost" />
              </span>,
            ],
            ["Environment", `${i.environment === "production" ? "Production" : "Test"} · ${i.connectivity === "online" ? "Online" : "Offline"}`],
            ["Added", formatDay(i.createdAt)],
            ...(i.retiredAt ? [["Retired", formatDay(i.retiredAt)] as [string, string]] : []),
          ]}
        />
        <Details
          items={[
            [
              "Last heartbeat",
              hb ? (
                <span key="hb" title={formatTime(hb.at)}>
                  {ago(hb.at)}
                  {hb.version ? <span className="text-ink-3"> · v{hb.version}</span> : null}
                  {hb.state ? <span className="text-ink-3"> · reported {hb.state}</span> : null}
                </span>
              ) : i.connectivity === "online" ? (
                licence ? "Never — check the server can reach the licence server" : "Not yet — it reports once it runs with a licence"
              ) : (
                "Not expected (offline)"
              ),
            ],
            [
              "Running copies",
              i.instances > 1 ? (
                <span key="copies" className="font-semibold">
                  {i.instances} in 30 days — reinstalled, or the licence is used twice
                </span>
              ) : (
                String(i.instances)
              ),
            ],
          ]}
        />
      </div>

      {licence ? (
        <div className="flex flex-col gap-2 rounded-ctl border border-line bg-surface-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-ink">Licence</span>
            <LicenceStatus display={licence.display} />
            <span className="text-ink-3">
              until {formatDay(licence.expiresOn)} ({relativeDays(licence.evaluation.daysLeft)})
            </span>
            <Link href={`/licences/${licence.id}`} className="ms-auto text-sm font-medium text-accent-text underline-offset-2 hover:underline">
              Open licence
            </Link>
          </div>
          <ProductTags ids={licence.products} />
        </div>
      ) : !i.retiredAt ? (
        <Notice tone="problem" title="No active licence">
          Issue one before this installation goes live; without it HIS starts read-only.
        </Notice>
      ) : null}

      {licence && !i.retiredAt ? <ReleaseRow installationId={i.id} latest={releases[0] ?? null} issuer={issuer} /> : null}

      {editing ? (
        <form action={editAction} className="flex flex-col gap-4 rounded-ctl border border-line p-3">
          <InstallationFields installation={i} fields={editResult && !editResult.ok ? editResult.fields : {}} values={editResult && !editResult.ok ? editResult.values : {}} />
          <ActionMessage result={editResult && !editResult.ok ? editResult : null} />
          <div className="flex gap-2">
            <SubmitButton tone="primary" pendingText="Saving…">
              Save
            </SubmitButton>
            <Button tone="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {confirmRetire ? (
        <Notice
          tone="problem"
          title={`Retire “${i.label}”?`}
          action={
            <>
              <Button
                tone="primary"
                size="sm"
                disabled={retiring}
                onClick={() => startRetire(async () => setRetireResult(await retireInstallation(i.id)))}
              >
                <PowerOff aria-hidden />
                {retiring ? "Retiring…" : "Retire and revoke"}
              </Button>
              <Button size="sm" tone="ghost" onClick={() => setConfirmRetire(false)}>
                <X aria-hidden />
                Keep it
              </Button>
            </>
          }
        >
          Its licence is revoked: if it is online it learns this at its next heartbeat, then has its grace period before turning
          read-only. Use this when the hospital no longer runs this copy.
        </Notice>
      ) : null}
      <ActionMessage result={retireResult} />
    </div>
  );

  if (flat) {
    return (
      <div className={cn("border-b border-line-2 px-pad py-row-y last:border-b-0")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{i.label}</span>
          <Status state="quiet">retired {formatDay(i.retiredAt)}</Status>
          <Code className="text-xs text-ink-3">{i.id}</Code>
        </div>
      </div>
    );
  }

  return (
    <Panel>
      <PanelHeader
        level="h2"
        title={i.label}
        meta={
          <>
            <Meta>{i.environment}</Meta>
            <Meta>{i.connectivity}</Meta>
          </>
        }
        actions={
          issuer ? (
            // wraps on phones instead of running out of the card
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" tone="ghost" onClick={() => setEditing(!editing)} aria-expanded={editing}>
                <Pencil aria-hidden />
                Edit
              </Button>
              <Button size="sm" tone="ghost" onClick={() => setConfirmRetire(true)} disabled={confirmRetire}>
                <PowerOff aria-hidden />
                Retire
              </Button>
              <LinkButton href={issueHref} size="sm" tone={licence && licence.display === "valid" ? "neutral" : "primary"}>
                {licence ? <RefreshCw aria-hidden /> : <FilePlus2 aria-hidden />}
                {licence ? "Renew licence" : "Issue licence"}
              </LinkButton>
            </div>
          ) : null
        }
      />
      <PanelBody>{body}</PanelBody>
    </Panel>
  );
}
