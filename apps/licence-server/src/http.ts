import type { ErrorRequestHandler, Request, Response } from "express";
import { z } from "zod";
import type { ApiErrorBody } from "@his/licence/api";

/*
 * The monolith's response shape (libs/platform/http/respond.ts), so the
 * control app moves there without its client changing:
 *   2xx { data, meta? }     4xx/5xx { error: { code, message, details? } }
 */

export class ApiError extends Error {
  status: number;
  code: string;
  details: { field: string; message: string }[] | undefined;
  constructor(status: number, code: string, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (message: string) => new ApiError(409, "CONFLICT", message);
export const badRequest = (message: string, code = "BAD_REQUEST") => new ApiError(400, code, message);

export function send<T>(res: Response, data: T, { status = 200, message }: { status?: number; message?: string } = {}) {
  res.status(status).json(message ? { data, meta: { message } } : { data });
}

/** Parse untrusted input; a failure answers 400 with one detail per field. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ApiError(
    400,
    "VALIDATION_FAILED",
    "Some fields are not valid",
    result.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message })),
  );
}

export const errorHandler: ErrorRequestHandler = (error, _req: Request, res: Response, _next) => {
  if (error instanceof ApiError) {
    const body: ApiErrorBody = { error: { code: error.code, message: error.message, details: error.details } };
    res.status(error.status).json(body);
    return;
  }
  // express.json(): a body that is not JSON
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "BAD_JSON", message: "The request body is not valid JSON" } } satisfies ApiErrorBody);
    return;
  }
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: { code: "TOO_LARGE", message: "The request body is too large" } } satisfies ApiErrorBody);
    return;
  }
  console.error(error);
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong on the licence server" } } satisfies ApiErrorBody);
};

export const now = () => new Date().toISOString();
