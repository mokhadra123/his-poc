"use client";

import { button, cn, Meta, Panel, PanelBody, PanelHeader } from "@his/ui";
import type { ReleaseDetail } from "@his/licence/api";
import { Check, Circle, Download, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Code, Details, ProductTags } from "@/components/bits";
import { CopyButton } from "@/components/client-bits";
import { Notice } from "@/components/fields";
import { BuildReleaseButton } from "../build-release-button";
import { formatBytes, formatTime, RELEASE_STEPS } from "@/lib/format";

/**
 * A release as it builds: the eight steps with the current one marked, and
 * the end of the log, refreshed every two seconds until it finishes.
 */
export function ReleaseLive({ initial, issuer }: { initial: ReleaseDetail; issuer: boolean }) {
  const [release, setRelease] = useState(initial);
  const router = useRouter();
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (release.status !== "running") return;
    const timer = setInterval(async () => {
      const response = await fetch(`/releases/${release.id}/status`, { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const next = (await response.json()).data as ReleaseDetail;
      setRelease(next);
      // the header and the rest of the page are server-rendered: refresh them once it ends
      if (next.status !== "running") router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [release.id, release.status, router]);

  // follow the end of the log, as a terminal does
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [release.log]);

  const current = Number(release.step?.match(/^\[(\d+)\/\d+\]/)?.[1] ?? 0);
  const stateOf = (index: number) => {
    const n = index + 1;
    if (release.status === "succeeded") return "done";
    if (n < current) return "done";
    if (n === current) return release.status === "failed" ? "failed" : "running";
    return "todo";
  };
  const bundleDir = release.bundle?.replace(/\.tar\.gz$/, "") ?? "";
  const commands = `tar -xzf ${release.bundle}\ncd ${bundleDir}\nsudo ./install.sh`;

  return (
    <div className="grid items-start gap-stack xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-stack">
        <Panel>
          <PanelHeader
            level="h2"
            title="Steps"
            meta={
              <Meta>
                {release.status === "succeeded" ? "all 8 done" : release.status === "failed" ? `stopped at ${current} of 8` : `step ${Math.max(current, 1)} of 8`}
              </Meta>
            }
          />
          <PanelBody>
            <ol className="flex flex-col gap-1">
              {RELEASE_STEPS.map((title, index) => {
                const state = stateOf(index);
                return (
                  <li
                    key={title}
                    aria-current={state === "running" ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-ctl px-2 py-1.5 text-sm",
                      state === "running" && "bg-surface-2 font-semibold text-ink",
                      state === "failed" && "border border-ink-3 bg-surface-2 font-semibold text-ink",
                      state === "todo" && "text-ink-3",
                      state === "done" && "text-ink-2",
                    )}
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line bg-surface [&_svg]:size-3.5">
                      {state === "done" ? <Check aria-hidden /> : state === "running" ? <LoaderCircle aria-hidden className="animate-spin" /> : state === "failed" ? <X aria-hidden /> : <Circle aria-hidden className="text-line" />}
                    </span>
                    <span className="min-w-0 flex-1">{title}</span>
                    <span className="sr-only">{state === "done" ? "done" : state === "running" ? "running" : state === "failed" ? "failed" : "waiting"}</span>
                  </li>
                );
              })}
            </ol>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader level="h2" title="What it builds" />
          <PanelBody>
            <Details
              items={[
                ["Customer", <Link key="c" href={`/customers/${release.customerId}`} className="hover:underline">{release.customerName.en}</Link>],
                ["Installation", `${release.installationLabel} (${release.connectivity})`],
                ["Licence", <Link key="l" href={`/licences/${release.licenceId}`} className="hover:underline"><Code>{release.licenceId.slice(0, 8)}</Code></Link>],
                ["Products", <ProductTags key="p" ids={release.products} />],
                ["Started", `${formatTime(release.createdAt)} by ${release.requestedBy}`],
                ...(release.finishedAt ? [["Finished", formatTime(release.finishedAt)] as [string, string]] : []),
                ...(release.image ? [["Image", <Code key="i" className="text-xs break-all">{release.image}</Code>] as [string, React.ReactNode]] : []),
              ]}
            />
          </PanelBody>
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-stack">
        {release.status === "succeeded" && release.bundle ? (
          <Panel>
            <PanelHeader
              level="h2"
              title="Deliver to the hospital"
              meta={<Meta>{formatBytes(release.bytes)}</Meta>}
              actions={
                issuer ? (
                  <a href={`/releases/${release.id}/bundle`} download className={button({ tone: "primary", size: "sm" })}>
                    <Download aria-hidden />
                    Download bundle
                  </a>
                ) : null
              }
            />
            <PanelBody className="flex flex-col gap-3 text-sm">
              <p className="text-ink-2">
                One file: <Code>{release.bundle}</Code>. It holds the image, the licence, the settings and the installer.{" "}
                {release.connectivity === "online"
                  ? "Once installed, this installation reports to the licence server and receives renewals by itself."
                  : "This installation is offline: renewals are uploaded under Setup → Licence in HIS."}
              </p>
              <p className="text-ink-3">On the hospital&apos;s server (Linux with Docker Engine 24+ and Docker Compose v2):</p>
              <div className="relative">
                <pre className="overflow-x-auto rounded-ctl border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink">{commands}</pre>
                <CopyButton value={commands} label="Copy" tone="ghost" className="absolute end-1.5 top-1.5" />
              </div>
              <p className="text-xs text-ink-3">
                The installer checks the files, loads HIS, keeps any licence already on the server unless this bundle&apos;s is newer,
                starts HIS and checks its licence. Running a newer bundle&apos;s installer upgrades in place.
              </p>
            </PanelBody>
          </Panel>
        ) : null}

        {release.status === "failed" ? (
          <Notice
            tone="problem"
            title="The build failed"
            action={issuer ? <BuildReleaseButton installationId={release.installationId} label="Build again" tone="primary" /> : null}
          >
            <p>{release.error ?? "The log below shows where it stopped."}</p>
          </Notice>
        ) : null}

        <Panel>
          <PanelHeader
            level="h2"
            title="Log"
            meta={release.status === "running" ? <Meta>live</Meta> : null}
          />
          <PanelBody flush>
            <pre
              ref={logRef}
              tabIndex={0}
              aria-label="Build log"
              className="h-[32rem] overflow-auto bg-surface-2 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-ink-2"
            >
              {release.log || "Waiting for the build to start…"}
            </pre>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
