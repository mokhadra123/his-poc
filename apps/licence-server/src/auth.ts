import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { ControlUser, Role } from "@his/licence/api";
import type { Db } from "./db.ts";
import { ApiError } from "./http.ts";

/*
 * People who may issue licences: our own team, not hospital staff. Sessions
 * are opaque random tokens; only their SHA-256 is stored, so a copy of the
 * database cannot be used to sign in. The control app keeps the token in an
 * httpOnly cookie and sends it as a Bearer token from its server.
 */

const N = 16384;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N });
  return `scrypt$${N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function checkPassword(password: string, stored: string): boolean {
  const [scheme, n, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, Buffer.from(salt, "base64"), expected.length, { N: Number(n) });
  return timingSafeEqual(actual, expected);
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

type UserRow = { id: number; email: string; name: string; role: Role; password_hash: string; disabled_at: string | null };

const toUser = (row: UserRow): ControlUser => ({ id: row.id, email: row.email, name: row.name, role: row.role });

export function createUser(db: Db, input: { email: string; name: string; role: Role; password: string }): ControlUser {
  const result = db
    .prepare("INSERT INTO users (email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(input.email.toLowerCase(), input.name, input.role, hashPassword(input.password), new Date().toISOString());
  return { id: Number(result.lastInsertRowid), email: input.email.toLowerCase(), name: input.name, role: input.role };
}

/*
 * ---------- login throttle ----------
 * Keyed by e-mail only: every sign-in reaches this server from the control
 * app, so the caller's address says nothing. After 5 failures in 15 minutes
 * each further try waits longer (15 s, 30 s, 1 min … at most 5 min) — a
 * guesser slows to a crawl, and the real owner is never locked out for long.
 */

const WINDOW_MS = 15 * 60_000;
const FREE_FAILURES = 5;
const failures = new Map<string, number[]>();

function recentFailures(key: string) {
  const since = Date.now() - WINDOW_MS;
  const list = (failures.get(key) ?? []).filter((t) => t > since);
  failures.set(key, list);
  return list;
}

/** ms to wait before the next try, 0 when it may go ahead */
function backoff(list: number[]) {
  if (list.length < FREE_FAILURES) return 0;
  const wait = Math.min(15_000 * 2 ** (list.length - FREE_FAILURES), 5 * 60_000);
  return Math.max(0, list[list.length - 1] + wait - Date.now());
}

// an unknown e-mail costs the same scrypt as a known one, so timing does not say which exist
let dummyHash: string | null = null;

export function login(db: Db, email: string, password: string, sessionHours: number) {
  const key = email.toLowerCase();
  const wait = backoff(recentFailures(key));
  if (wait > 0) {
    throw new ApiError(429, "TOO_MANY_ATTEMPTS", `Too many failed sign-ins. Try again in ${Math.ceil(wait / 1000)} seconds.`);
  }
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(key) as UserRow | undefined;
  dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
  const passwordOk = checkPassword(password, row?.password_hash ?? dummyHash);
  // the same answer whether the e-mail exists or not
  if (!row || row.disabled_at || !passwordOk) {
    recentFailures(key).push(Date.now());
    throw new ApiError(401, "INVALID_CREDENTIALS", "The e-mail or password is not correct");
  }
  failures.delete(key);
  const token = randomBytes(32).toString("base64url");
  const created = new Date();
  const expiresAt = new Date(created.getTime() + sessionHours * 3_600_000).toISOString();
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    tokenHash(token),
    row.id,
    created.toISOString(),
    expiresAt,
  );
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(created.toISOString());
  return { token, expiresAt, user: toUser(row) };
}

export function logout(db: Db, token: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}

function bearer(req: Request): string | null {
  const header = req.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() || null : null;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: ControlUser;
    token?: string;
  }
}

/** Every /api route but sign-in and the installations' own endpoints goes through this. */
export function requireSession(db: Db) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = bearer(req);
    if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Sign in first");
    const row = db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled_at IS NULL`,
      )
      .get(tokenHash(token), new Date().toISOString()) as UserRow | undefined;
    if (!row) throw new ApiError(401, "SESSION_EXPIRED", "Your session has ended. Sign in again.");
    req.user = toUser(row);
    req.token = token;
    next();
  };
}

const RANK: Record<Role, number> = { viewer: 0, issuer: 1, owner: 2 };

/** issuer: may change customers, installations and licences · owner: may also manage signing keys */
export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || RANK[req.user.role] < RANK[role]) {
      throw new ApiError(403, "FORBIDDEN", `This needs the ${role} role; you are ${req.user?.role ?? "signed out"}`);
    }
    next();
  };
}
