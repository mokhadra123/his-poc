"use client";

import { Button, Panel, PanelBody, PanelHeader, Status } from "@his/ui";
import { ExternalLink, Layers, Play, Square } from "lucide-react";
import { useState, useTransition } from "react";
import { runAction } from "@/app/actions";
import type { ActionResult, RunAction, RunStatus } from "@/lib/types";
import { Notice } from "./fields";

/** Why compose / compose & run cannot run now, or null. */
function blocker(status: RunStatus, id: string, dirty: boolean): string | null {
  const { busy, server } = status;
  if (busy === "compose") return "Composing…";
  if (busy === "stop") return "Stopping…";
  if (server) {
    return server.customerId === id
      ? `The showcase for "${id}" is running. Stop it to compose again.`
      : `The showcase is running for "${server.customerId}". Stop it before composing "${id}".`;
  }
  if (busy === "start") return "Starting…";
  if (status.portInUse) return `Port ${status.port} is in use by a process this panel did not start.`;
  if (dirty) return "Save or revert your changes first: compose uses the saved customer.json.";
  return null;
}

export function RunPanel({
  status,
  customerId,
  dirty,
  onChange,
}: {
  status: RunStatus;
  customerId: string;
  dirty: boolean;
  /** refresh the status now rather than at the next poll */
  onChange: () => void;
}) {
  const [pending, startAction] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const { server, composed, last } = status;
  const blocked = blocker(status, customerId, dirty);

  const run = (action: RunAction) =>
    startAction(async () => {
      setResult(null);
      setResult(await runAction(action, customerId));
      onChange();
    });

  return (
    <Panel>
      <PanelHeader level="h3" title="Compose & run" />
      <PanelBody className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-3">Composed</dt>
          <dd>
            {composed ? (
              <>
                <code className="font-mono">{composed.customerId}</code> · palette{" "}
                {composed.themePaletteCustomization ? "changeable" : "default only"}
              </>
            ) : (
              "nothing yet"
            )}
          </dd>
          <dt className="text-ink-3">Showcase</dt>
          <dd>
            {server ? (
              server.ready ? (
                <>
                  running <code className="font-mono">{server.customerId}</code> at{" "}
                  <a
                    href={server.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-accent-text underline"
                  >
                    {server.url}
                    <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                </>
              ) : (
                <>
                  starting <code className="font-mono">{server.customerId}</code>…
                </>
              )
            ) : (
              "not running"
            )}
          </dd>
        </dl>

        {status.portInUse && !server ? (
          <Notice tone="problem" title={`Port ${status.port} is in use by a process this panel did not start`}>
            Probably a showcase started from a terminal (npm run dev) or left running by an earlier panel session.
            Stop it yourself — the panel only stops what it started. Compose and run stay off until the port is free.
          </Notice>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run("compose")} disabled={Boolean(blocked) || pending}>
            <Layers aria-hidden />
            Compose
          </Button>
          <Button tone="primary" onClick={() => run("start")} disabled={Boolean(blocked) || pending}>
            <Play aria-hidden />
            Compose &amp; run
          </Button>
          <Button onClick={() => run("stop")} disabled={!server || status.busy === "stop" || pending}>
            <Square aria-hidden />
            Stop
          </Button>
        </div>
        <p className="text-sm text-ink-3">
          {blocked ??
            `Compose writes ${customerId}'s routes, nav and outlets into apps/showcase. Compose & run then starts its dev server on port ${status.port}.`}
        </p>

        {result && !result.ok ? <Notice tone="problem" title={result.error} /> : null}
        {last ? (
          <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
            <Status state={last.ok ? "done" : "attention"}>{last.ok ? "succeeded" : "failed"}</Status>
            <span className="text-ink">{last.message}</span>
            {last.exitCode !== null ? <span className="text-ink-3">exit code {last.exitCode}</span> : null}
            <time dateTime={last.at} className="text-ink-3">
              {new Date(last.at).toLocaleTimeString()}
            </time>
          </p>
        ) : null}

        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold text-ink-2">Output</h4>
          <pre className="max-h-96 min-h-24 overflow-auto rounded-ctl border border-line bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap text-ink-2">
            {status.output.length ? status.output.join("\n") : "Nothing yet."}
          </pre>
        </div>
      </PanelBody>
    </Panel>
  );
}
