import type { AttentionItem, AttentionKind, Overview } from "@his/licence/api";
import { listAudit } from "./audit.ts";
import type { Db } from "./db.ts";
import { INSTANCE_WINDOW_DAYS, listInstallations, SILENT_AFTER_DAYS } from "./installations.ts";

/* The first screen: what needs someone today, most urgent first. */

const ORDER: Record<AttentionKind, number> = { "read-only": 0, grace: 1, duplicate: 2, expiring: 3, silent: 4, unlicensed: 5 };

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export function overview(db: Db): Overview {
  const installations = listInstallations(db, { includeRetired: false });
  const attention: AttentionItem[] = [];
  const silentBefore = Date.now() - SILENT_AFTER_DAYS * 86_400_000;
  let silent = 0;

  for (const i of installations) {
    const base = {
      customerId: i.customerId,
      customerName: i.customerName,
      installationId: i.id,
      installationLabel: i.label,
      licenceId: i.licence?.id ?? null,
    };
    const e = i.licence?.evaluation;
    if (!i.licence || !e) {
      attention.push({ ...base, kind: "unlicensed", detail: "No active licence — issue one before it goes live", due: null });
    } else if (e.state === "read-only") {
      attention.push({ ...base, kind: "read-only", detail: `Read-only since ${e.timeline.readOnlyFrom}: new records are blocked`, due: e.timeline.readOnlyFrom });
    } else if (e.state === "grace") {
      attention.push({
        ...base,
        kind: "grace",
        detail: `Expired on ${e.timeline.endsOn}; read-only in ${days(e.graceDaysLeft + 1)}`,
        due: e.timeline.readOnlyFrom,
      });
    } else if (e.state === "warning") {
      attention.push({
        ...base,
        kind: "expiring",
        detail: e.daysLeft === 0 ? "Expires today" : `Expires in ${days(e.daysLeft)}`,
        due: e.timeline.endsOn,
      });
    }

    if (i.instances > 1) {
      attention.push({
        ...base,
        kind: "duplicate",
        detail: `${i.instances} running copies reported in ${INSTANCE_WINDOW_DAYS} days — reinstalled, or the licence is used twice`,
        due: null,
      });
    }

    if (i.connectivity === "online" && i.licence) {
      const last = i.lastHeartbeat ? Date.parse(i.lastHeartbeat.at) : null;
      if (last === null || last < silentBefore) {
        silent += 1;
        attention.push({
          ...base,
          kind: "silent",
          detail: last === null ? "Online, but has never reported" : `No heartbeat since ${i.lastHeartbeat!.at.slice(0, 10)}`,
          due: null,
        });
      }
    }
  }

  attention.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || (a.due ?? "9").localeCompare(b.due ?? "9"));

  const active = installations.flatMap((i) => (i.licence ? [i.licence] : []));
  const customers = db.prepare("SELECT count(*) AS n FROM customers WHERE archived_at IS NULL").get() as { n: number };
  return {
    counts: {
      customers: Number(customers.n),
      installations: installations.length,
      activeLicences: active.length,
      expiringSoon: active.filter((l) => l.evaluation.state === "warning").length,
      inGrace: active.filter((l) => l.evaluation.state === "grace").length,
      readOnly: active.filter((l) => l.evaluation.state === "read-only").length,
      silent,
    },
    attention,
    recent: listAudit(db, { limit: 8 }),
  };
}
