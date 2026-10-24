/*
 * The heartbeat of an online installation: started by instrumentation.ts when
 * HIS_LICENCE_SERVER_URL is set, it tells the licence server which licence
 * runs here, on start and every HIS_HEARTBEAT_SECONDS (default 3600).
 *
 *   POST ${HIS_LICENCE_SERVER_URL}/api/v1/heartbeat   HeartbeatInput → { data: HeartbeatResult }
 *
 *   renewed  the answer carries a newer licence: installed like an upload
 *   revoked  the licence ends on revokedOn, then grace applies as usual
 *
 * Every failure is logged and ignored: a hospital never waits on the network.
 * An air-gapped installation has no heartbeat and renews by uploading a file.
 */
import type { Envelope, HeartbeatInput, HeartbeatResult } from "@his/licence/api";
import { LICENSING } from "./licence.generated";
import { getLicence, installLicence, readState, updateState } from "./licence-store";

const STARTED = Symbol.for("his.licence.heartbeat");
const TIMEOUT_MS = 15_000;

export function startHeartbeat() {
  const server = process.env.HIS_LICENCE_SERVER_URL?.replace(/\/+$/, "");
  if (!server || !LICENSING.enabled) return;
  // register() runs once per server, but dev reloads must not start a second timer
  const flags = globalThis as unknown as Record<symbol, boolean | undefined>;
  if (flags[STARTED]) return;
  flags[STARTED] = true;

  const seconds = Number(process.env.HIS_HEARTBEAT_SECONDS) > 0 ? Number(process.env.HIS_HEARTBEAT_SECONDS) : 3600;
  console.log(`licence: heartbeat to ${server} every ${seconds} s`);
  void beat(server);
  // unref: the timer never keeps a stopping server alive
  setInterval(() => void beat(server), seconds * 1000).unref();
}

async function beat(server: string) {
  const at = new Date().toISOString();
  try {
    const check = getLicence();
    // the installation and licence ids come from the licence; without one there is nothing to report
    if (!check.licensing || check.status !== "ok") {
      console.warn(`licence: heartbeat skipped — the installed licence is ${check.licensing ? check.status : "off"}`);
      return;
    }
    const input: HeartbeatInput = {
      installationId: check.payload.installationId,
      licenceId: check.payload.licenceId,
      instanceId: readState().instanceId,
      version: process.env.HIS_VERSION ?? process.env.npm_package_version ?? null,
      state: check.evaluation.state,
    };
    const response = await fetch(`${server}/api/v1/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as
      | (Envelope<HeartbeatResult> & { error?: { message?: string } })
      | null;
    if (!response.ok || !body?.data) {
      throw new Error(body?.error?.message ?? `the licence server answered ${response.status}`);
    }
    const result = body.data;
    let message = result.message;

    if (result.status === "renewed") {
      const installed = installLicence(JSON.stringify(result.licence), { fromLicenceServer: true });
      message = installed.ok ? `${result.message} — ${installed.message}` : `${result.message} — not installed: ${installed.message}`;
      console.log(`licence: ${message}`);
    } else if (result.status === "revoked") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(result.revokedOn)) throw new Error(`revokedOn is not a date: ${result.revokedOn}`);
      updateState((s) => ({ ...s, revokedOn: result.revokedOn }));
      console.warn(`licence: revoked on ${result.revokedOn} — ${result.message}`);
    }
    updateState((s) => ({ ...s, lastHeartbeat: { at, status: result.status, message } }));
  } catch (error) {
    // fetch says only "fetch failed"; the cause says why (ECONNREFUSED, a timeout …)
    const cause = error instanceof Error ? (error.cause as { code?: string; message?: string } | undefined) : undefined;
    const reason = cause?.code ?? cause?.message;
    const message = `${error instanceof Error ? error.message : String(error)}${reason ? ` (${reason})` : ""}`;
    console.error(`licence: heartbeat failed — ${message}`);
    try {
      updateState((s) => ({ ...s, lastHeartbeat: { at, status: "error", message } }));
    } catch {
      // nothing else to do: the next beat tries again
    }
  }
}
