/*
 * Server only. The browser never talks to the licence server: every request
 * goes from this app's server with the session token from an httpOnly
 * cookie, so the token is never readable by page scripts.
 */
import type { ApiErrorBody, ControlUser, Envelope, Role } from "@his/licence/api";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export const API_URL = (process.env.CONTROL_API_URL ?? "http://127.0.0.1:4300").replace(/\/+$/, "");
export const SESSION_COOKIE = "his-control-session";

/** The licence server answered with an error the user can read */
export class ControlApiError extends Error {
  status: number;
  code: string;
  details: { field: string; message: string }[];
  constructor(status: number, body: ApiErrorBody["error"] | undefined) {
    super(body?.message ?? `The licence server answered ${status}`);
    this.status = status;
    this.code = body?.code ?? "UNKNOWN";
    this.details = body?.details ?? [];
  }
}

/** The licence server is not running or not reachable */
export class ApiUnreachable extends Error {
  constructor() {
    super(`The licence server is not answering at ${API_URL}`);
    this.name = "ApiUnreachable";
  }
}

type Options = { method?: "GET" | "POST" | "PUT"; body?: unknown; token?: string | null };

export async function request<T>(path: string, { method = "GET", body, token }: Options = {}): Promise<{ data: T; message?: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiUnreachable();
  }
  // the session ended on the server (expired, signed out elsewhere)
  if (response.status === 401 && token) redirect("/login?expired=1");
  const json = (await response.json().catch(() => null)) as (Envelope<T> & ApiErrorBody) | null;
  if (!response.ok) throw new ControlApiError(response.status, json?.error);
  return { data: json?.data as T, message: json?.meta?.message };
}

export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** A request on behalf of the signed-in person; no session → the sign-in page */
export async function api<T>(path: string, options: Omit<Options, "token"> = {}) {
  const token = await sessionToken();
  if (!token) redirect("/login");
  return request<T>(path, { ...options, token });
}

export async function get<T>(path: string): Promise<T> {
  return (await api<T>(path)).data;
}

/** Who is signed in — asked once per request */
export const currentUser = cache(async (): Promise<ControlUser> => get<ControlUser>("/api/auth/me"));

const RANK: Record<Role, number> = { viewer: 0, issuer: 1, owner: 2 };
export const can = (user: ControlUser, role: Role) => RANK[user.role] >= RANK[role];
