"use server";

/*
 * Everything the browser can ask for. Inputs are untrusted: the licence server
 * validates them again and answers with per-field messages, which come back
 * here as `fields`. A redirect (no session, a finished create) is rethrown.
 */
import type { Customer, CustomerTheme, Installation, IssueInput, LicenceDetail, LoginResult, Release } from "@his/licence/api";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { api, ApiUnreachable, ControlApiError, request, SESSION_COOKIE, sessionToken } from "@/lib/api";

export type ActionResult =
  | { ok: true; message: string }
  /** values: what was typed, so a refused form shows it again (React resets a form after its action) */
  | { ok: false; error: string; fields: Record<string, string>; values: Record<string, string> }
  | null;

/** the form's text fields, never a password */
function typed(form?: FormData): Record<string, string> {
  if (!form) return {};
  return Object.fromEntries(
    [...form.entries()].filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "password" && !e[0].startsWith("$")),
  );
}

async function attempt(work: () => Promise<string>, form?: FormData): Promise<ActionResult> {
  try {
    return { ok: true, message: await work() };
  } catch (error) {
    unstable_rethrow(error);
    const values = typed(form);
    if (error instanceof ControlApiError) {
      return { ok: false, error: error.message, fields: Object.fromEntries(error.details.map((d) => [d.field, d.message])), values };
    }
    if (error instanceof ApiUnreachable) {
      return { ok: false, error: `${error.message}. Start it with npm run dev -w @his/licence-server.`, fields: {}, values };
    }
    console.error(error);
    return { ok: false, error: "Something unexpected went wrong; the details are in the control app's log", fields: {}, values };
  }
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
/**
 * A safe place to go after sign-in: a path on this app only. Parsed rather
 * than prefix-checked — "/\evil.com" and "/<tab>/evil.com" start with one
 * slash but a browser resolves them to another host.
 */
function localPath(value: string): string {
  try {
    const url = new URL(value, "http://control.invalid");
    return url.origin === "http://control.invalid" ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}

/* ---------- session ---------- */

export async function signIn(_: ActionResult, form: FormData): Promise<ActionResult> {
  let next = "/";
  const result = await attempt(async () => {
    const { data } = await request<LoginResult>("/api/auth/login", {
      method: "POST",
      body: { email: text(form, "email"), password: String(form.get("password") ?? "") },
    });
    (await cookies()).set(SESSION_COOKIE, data.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(data.expiresAt),
    });
    next = localPath(text(form, "next"));
    return "Signed in";
  }, form);
  if (result?.ok) redirect(next);
  return result;
}

export async function signOut() {
  const token = await sessionToken();
  if (token) await request("/api/auth/logout", { method: "POST", token }).catch(() => {});
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/* ---------- customers ---------- */

function customerFields(form: FormData) {
  return {
    name: { en: text(form, "name.en"), ar: text(form, "name.ar") },
    contactName: text(form, "contactName"),
    contactEmail: text(form, "contactEmail"),
    country: text(form, "country"),
    notes: text(form, "notes"),
  };
}

export async function createCustomer(_: ActionResult, form: FormData): Promise<ActionResult> {
  let id = "";
  const result = await attempt(async () => {
    const { data, message } = await api<Customer>("/api/customers", {
      method: "POST",
      body: { id: text(form, "id"), ...customerFields(form) },
    });
    id = data.id;
    return message ?? "Created";
  }, form);
  if (result?.ok) {
    revalidatePath("/", "layout");
    redirect(`/customers/${id}?created=1`);
  }
  return result;
}

export async function updateCustomer(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const { message } = await api<Customer>(`/api/customers/${encodeURIComponent(id)}`, { method: "PUT", body: customerFields(form) });
    revalidatePath("/", "layout");
    return message ?? "Saved";
  }, form);
}

export async function setCustomerArchived(id: string, archived: boolean): Promise<ActionResult> {
  return attempt(async () => {
    const { message } = await api<Customer>(`/api/customers/${encodeURIComponent(id)}/${archived ? "archive" : "restore"}`, { method: "POST" });
    revalidatePath("/", "layout");
    return message ?? "Done";
  });
}

/** The customer's themes; applies from its next build (compose reads customer.json). */
export async function setCustomerTheme(id: string, theme: CustomerTheme): Promise<ActionResult> {
  return attempt(async () => {
    const { message } = await api<Customer>(`/api/customers/${encodeURIComponent(id)}/theme`, { method: "PUT", body: theme });
    revalidatePath("/", "layout");
    return message ?? "Saved";
  });
}

/** Builds the installation's HIS from its active licence; the release page follows the build. */
export async function buildRelease(installationId: string): Promise<ActionResult> {
  let id = "";
  const result = await attempt(async () => {
    const { data, message } = await api<Release>(`/api/installations/${encodeURIComponent(installationId)}/releases`, { method: "POST" });
    id = data.id;
    return message ?? "Started";
  });
  if (result?.ok) {
    revalidatePath("/", "layout");
    redirect(`/releases/${id}`);
  }
  return result;
}

/* ---------- installations ---------- */

function installationFields(form: FormData) {
  return { label: text(form, "label"), environment: text(form, "environment"), connectivity: text(form, "connectivity") };
}

export async function addInstallation(customerId: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const { message } = await api<Installation>(`/api/customers/${encodeURIComponent(customerId)}/installations`, {
      method: "POST",
      body: installationFields(form),
    });
    revalidatePath("/", "layout");
    return message ?? "Added";
  }, form);
}

export async function updateInstallation(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const { message } = await api<Installation>(`/api/installations/${encodeURIComponent(id)}`, { method: "PUT", body: installationFields(form) });
    revalidatePath("/", "layout");
    return message ?? "Saved";
  }, form);
}

export async function retireInstallation(id: string): Promise<ActionResult> {
  return attempt(async () => {
    const { message } = await api<Installation>(`/api/installations/${encodeURIComponent(id)}/retire`, { method: "POST" });
    revalidatePath("/", "layout");
    return message ?? "Retired";
  });
}

/* ---------- licences ---------- */

export async function issueLicence(input: IssueInput): Promise<ActionResult> {
  let id = "";
  const result = await attempt(async () => {
    const { data, message } = await api<LicenceDetail>("/api/licences", { method: "POST", body: input });
    id = data.id;
    return message ?? "Issued";
  });
  if (result?.ok) {
    revalidatePath("/", "layout");
    redirect(`/licences/${id}?issued=1`);
  }
  return result;
}

export async function revokeLicence(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  const result = await attempt(async () => {
    const { message } = await api<LicenceDetail>(`/api/licences/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
      body: { reason: text(form, "reason") },
    });
    return message ?? "Revoked";
  }, form);
  // the revoke panel goes away with the active licence: say it at the top of the page instead
  if (result?.ok) {
    revalidatePath("/", "layout");
    redirect(`/licences/${encodeURIComponent(id)}?revoked=1`);
  }
  return result;
}

/* ---------- catalog and keys ---------- */

export async function syncCatalog(): Promise<ActionResult> {
  return attempt(async () => {
    const { message } = await api("/api/catalog/sync", { method: "POST" });
    revalidatePath("/", "layout");
    return message ?? "Synced";
  });
}

export async function rotateKey(): Promise<ActionResult> {
  return attempt(async () => {
    const { message } = await api("/api/keys/rotate", { method: "POST" });
    revalidatePath("/", "layout");
    return message ?? "Rotated";
  });
}
