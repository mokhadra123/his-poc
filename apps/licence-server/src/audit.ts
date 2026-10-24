import type { AuditEntry, ControlUser } from "@his/licence/api";
import type { Db } from "./db.ts";

/* Who did what, in words a person reads. Written in the same transaction as the change. */

export function audit(
  db: Db,
  actor: ControlUser | null,
  action: string,
  target: { type: AuditEntry["targetType"]; id: string },
  summary: string,
) {
  db.prepare(
    "INSERT INTO audit (at, user_id, actor, action, target_type, target_id, summary) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(new Date().toISOString(), actor?.id ?? null, actor?.name ?? "system", action, target.type, target.id, summary);
}

type AuditRow = { id: number; at: string; actor: string; action: string; target_type: AuditEntry["targetType"]; target_id: string; summary: string };

export function listAudit(
  db: Db,
  { limit = 100, targetType, targetId, customerId }: { limit?: number; targetType?: string; targetId?: string; customerId?: string } = {},
): AuditEntry[] {
  const where: string[] = [];
  const args: string[] = [];
  if (targetType) {
    where.push("target_type = ?");
    args.push(targetType);
  }
  if (targetId) {
    where.push("target_id = ?");
    args.push(targetId);
  }
  if (customerId) {
    // the customer itself, its installations and their licences
    where.push(`(
      (target_type = 'customer' AND target_id = ?)
      OR (target_type = 'installation' AND target_id IN (SELECT id FROM installations WHERE customer_id = ?))
      OR (target_type = 'licence' AND target_id IN (SELECT id FROM licences WHERE customer_id = ?))
    )`);
    args.push(customerId, customerId, customerId);
  }
  const rows = db
    .prepare(`SELECT * FROM audit ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`)
    .all(...args, Math.min(Math.max(limit, 1), 500)) as AuditRow[];
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    actor: r.actor,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    summary: r.summary,
  }));
}
