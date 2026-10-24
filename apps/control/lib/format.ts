/*
 * Dates and states as people read them. Plain functions, usable on the server
 * and in client components.
 */
import type { AttentionKind, LicenceDisplay, Standing } from "@his/licence/api";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DAY_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** "2026-12-31" or an ISO time → "31 Dec 2026" */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : DAY.format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return `${DAY_TIME.format(new Date(value))} UTC`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** days from today: 0 → "today", 3 → "in 3 days", -2 → "2 days ago" */
export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${plural(days, "day")}` : `${plural(-days, "day")} ago`;
}

/** an ISO time → "5 minutes ago", "3 days ago" */
export function ago(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "never";
  const seconds = Math.max(0, Math.round((now - Date.parse(value)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${plural(minutes, "minute")} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${plural(hours, "hour")} ago`;
  return `${plural(Math.round(hours / 24), "day")} ago`;
}

/* ---------- states ----------
 * A licence is operational, not clinical: in this design system it is a
 * neutral <Status>, never a clinical colour. The words carry the meaning;
 * "attention" (heavier border and weight) marks what someone must act on. */

export type StatusState = "quiet" | "pending" | "done" | "attention";

export const DISPLAY: Record<LicenceDisplay | Standing["state"], { label: string; state: StatusState; help: string }> = {
  valid: { label: "Valid", state: "done", help: "Fully licensed" },
  warning: { label: "Expiring", state: "pending", help: "In the warning period before the licence ends" },
  grace: { label: "In grace", state: "attention", help: "Ended; still working during the grace period" },
  "read-only": { label: "Read-only", state: "attention", help: "Grace is over: viewing works, new records are blocked" },
  revoked: { label: "Revoked", state: "quiet", help: "Withdrawn by us; the installation was told at its next heartbeat" },
  superseded: { label: "Superseded", state: "quiet", help: "Replaced by a newer licence" },
  unlicensed: { label: "No licence", state: "attention", help: "No active licence" },
};

export const ATTENTION: Record<AttentionKind, { label: string; state: StatusState }> = {
  "read-only": { label: "Read-only", state: "attention" },
  grace: { label: "In grace", state: "attention" },
  duplicate: { label: "Two copies", state: "attention" },
  expiring: { label: "Expiring", state: "pending" },
  silent: { label: "Silent", state: "pending" },
  unlicensed: { label: "No licence", state: "pending" },
};

/** A release: building is waiting on the machine, ready is done, failed needs someone */
export const RELEASE: Record<"running" | "succeeded" | "failed", { label: string; state: StatusState }> = {
  running: { label: "Building", state: "pending" },
  succeeded: { label: "Ready", state: "done" },
  failed: { label: "Failed", state: "attention" },
};

/** The eight steps of scripts/release.mjs, in order */
export const RELEASE_STEPS = [
  "Copy the repository",
  "Compose from the licence",
  "Build the app",
  "Verify the build",
  "Build the image",
  "Ship the image",
  "Write the bundle",
  "Pack the bundle",
] as const;

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export const ROLE_LABEL = { owner: "Owner", issuer: "Issuer", viewer: "Viewer" } as const;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
