/*
 * The control API (apps/licence-server) as its client (apps/control) sees it.
 * Every answer is the monolith's envelope:
 *
 *   2xx  { "data": …, "meta"?: { "message"?: … } }
 *   4xx  { "error": { "code": "…", "message": "…", "details"?: [{ "field", "message" }] } }
 */
import type { LicenceFile, Localized } from "./payload.ts";
import type { LicenceEvaluation, LicenceState } from "./state.ts";

export type Envelope<T> = { data: T; meta?: { message?: string } };
export type ApiErrorBody = { error: { code: string; message: string; details?: { field: string; message: string }[] } };

/* ---------- people ---------- */

/** owner: everything, signing keys included · issuer: customers, installations, licences · viewer: read only */
export type Role = "owner" | "issuer" | "viewer";
export type ControlUser = { id: number; email: string; name: string; role: Role };
export type LoginInput = { email: string; password: string };
export type LoginResult = { token: string; expiresAt: string; user: ControlUser };

/* ---------- catalog ---------- */

export type Product = {
  id: string;
  package: string;
  name: Localized;
  routes: string[];
  slots: string[];
  /** no longer in the repository; kept so old licences still name it */
  retired: boolean;
  syncedAt: string;
  /** active licences that include it */
  licences: number;
};

/* ---------- customers ---------- */

/** The customer's own code in the repository (customers/<id>/package.json), if any */
export type OwnCode = { package: string; routes: string[]; slots: string[] };

/** The worst state among the customer's installations — what needs attention first */
export type Standing = {
  state: LicenceState | "unlicensed";
  /** the nearest end among active licences */
  endsOn: string | null;
  daysLeft: number | null;
};

/**
 * The customer's themes (customer.json → "theme"; @his/ui ThemePolicy): one
 * theme is a fixed look, several let each user switch. brand: the hospital's
 * colour for the custom theme, null lets users pick it.
 */
export type CustomerTheme = { default: string; allowed: string[]; brand: string | null };

export type Customer = {
  id: string;
  name: Localized;
  contactName: string | null;
  contactEmail: string | null;
  country: string | null;
  notes: string | null;
  createdAt: string;
  archivedAt: string | null;
  ownCode: OwnCode | null;
  installations: number;
  /** products on the customer's active licences */
  products: string[];
  standing: Standing;
  theme: CustomerTheme;
};

export type CustomerInput = {
  id: string;
  name: Localized;
  contactName?: string | null;
  contactEmail?: string | null;
  country?: string | null;
  notes?: string | null;
};
export type CustomerUpdate = Omit<CustomerInput, "id">;

/* ---------- installations ---------- */

export type Environment = "production" | "test";
export type Connectivity = "online" | "offline";

export type Heartbeat = {
  at: string;
  instanceId: string;
  version: string | null;
  state: string | null;
  address: string | null;
};

export type Installation = {
  id: string;
  customerId: string;
  customerName: Localized;
  label: string;
  environment: Environment;
  connectivity: Connectivity;
  createdAt: string;
  retiredAt: string | null;
  lastHeartbeat: Heartbeat | null;
  /** distinct running copies seen in the last 30 days; more than one means the licence is used twice */
  instances: number;
  /** the active licence */
  licence: LicenceRow | null;
};

export type InstallationInput = { label: string; environment: Environment; connectivity: Connectivity };

/* ---------- licences ---------- */

export type LicenceStatus = "active" | "superseded" | "revoked";
/** What a person should read first: the record's status, or the active licence's state */
export type LicenceDisplay = LicenceState | "revoked" | "superseded";

export type LicenceRow = {
  id: string;
  customerId: string;
  customerName: Localized;
  installationId: string;
  installationLabel: string;
  products: string[];
  issuedAt: string;
  expiresOn: string;
  warnDays: number;
  graceDays: number;
  kid: string;
  status: LicenceStatus;
  display: LicenceDisplay;
  revokedAt: string | null;
  revokeReason: string | null;
  supersededBy: string | null;
  supersedes: string | null;
  issuedBy: string;
  note: string | null;
  evaluation: LicenceEvaluation;
};

export type LicenceDetail = LicenceRow & { file: LicenceFile; fingerprint: string };

export type IssueInput = {
  installationId: string;
  products: string[];
  expiresOn: string;
  warnDays: number;
  graceDays: number;
  note?: string | null;
};

export type RevokeInput = { reason: string };

/* ---------- releases ---------- */

export type ReleaseStatus = "running" | "succeeded" | "failed";

/** One build of an installation's HIS from its licence: an image and the bundle delivered to the hospital */
export type Release = {
  id: string;
  installationId: string;
  installationLabel: string;
  connectivity: Connectivity;
  customerId: string;
  customerName: Localized;
  licenceId: string;
  products: string[];
  status: ReleaseStatus;
  /** the step running now, or the last one: "[5/8] Building the image …" */
  step: string | null;
  version: string | null;
  image: string | null;
  /** the bundle's file name, when built */
  bundle: string | null;
  bytes: number | null;
  error: string | null;
  requestedBy: string;
  createdAt: string;
  finishedAt: string | null;
};

export type ReleaseDetail = Release & { log: string };

/* ---------- signing keys ---------- */

export type SigningKey = {
  kid: string;
  fingerprint: string;
  publicKey: string;
  createdAt: string;
  /** new licences are signed with the active key; older keys stay trusted */
  active: boolean;
  licences: number;
};

/* ---------- audit ---------- */

export type AuditEntry = {
  id: number;
  at: string;
  actor: string;
  action: string;
  targetType: "customer" | "installation" | "licence" | "release" | "key" | "catalog" | "session";
  targetId: string;
  summary: string;
};

/* ---------- overview ---------- */

export type AttentionKind = "read-only" | "grace" | "expiring" | "duplicate" | "silent" | "unlicensed";

export type AttentionItem = {
  kind: AttentionKind;
  customerId: string;
  customerName: Localized;
  installationId: string;
  installationLabel: string;
  licenceId: string | null;
  detail: string;
  /** the day it matters by, when there is one */
  due: string | null;
};

export type Overview = {
  counts: {
    customers: number;
    installations: number;
    activeLicences: number;
    expiringSoon: number;
    inGrace: number;
    readOnly: number;
    silent: number;
  };
  attention: AttentionItem[];
  recent: AuditEntry[];
};

/* ---------- heartbeat (called by installations, no session) ---------- */

export type HeartbeatInput = {
  installationId: string;
  licenceId: string;
  /** random id a running copy makes for itself on first start */
  instanceId: string;
  version?: string | null;
  state?: string | null;
};

export type HeartbeatResult =
  | { status: "ok"; message: string }
  /** a newer licence was issued for this installation: install it */
  | { status: "renewed"; message: string; licence: LicenceFile }
  /** the licence was revoked: it ends on revokedOn, then grace applies */
  | { status: "revoked"; message: string; revokedOn: string }
  | { status: "unknown"; message: string };
