import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { env } from "@/lib/env";

type ApiErrorCode =
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "db_unavailable"
  | "service_unavailable";

export function apiError(error: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

/**
 * LC10h P3 (LC-01): a 429 must carry the stable `rate_limited` code (not
 * `invalid_input`) so clients can programmatically detect throttling and back
 * off, instead of parsing the Chinese message. `Retry-After` (seconds) is
 * surfaced from the limiter's `retryAfterMs` when known.
 */
export function rateLimitedError(message: string, retryAfterMs?: number) {
  const res = apiError("rate_limited", message, 429);
  if (retryAfterMs && retryAfterMs > 0) {
    res.headers.set("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
  }
  return res;
}

export function handleRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) {
    return apiError("invalid_input", "请求参数格式不正确，请检查后重试。", 400);
  }

  // itest8 P2：畸形请求体 request.json() 抛 V8 原生 SyntaxError（"Unexpected token ... is not
  // valid JSON"）。不能把英文原生错误+回显的原始输入直接返给用户——既违反「中文错误文案」不变量、
  // 又属轻度信息泄露。统一收成中文 invalid_input，一处修全部走 handleRouteError 的路由。
  if (error instanceof SyntaxError) {
    return apiError("invalid_input", "请求格式不正确，请检查后重试。", 400);
  }

  const message = error instanceof Error ? error.message : fallbackMessage;

  // DB/connectivity faults map to a calm Chinese 503 — never leak the raw
  // internal message to a student. The client-side query race throws
  // "<fn> timed out after Nms" (note: "timed out", not "timeout"), so match
  // both spellings plus the common node socket codes and the Chinese 超时.
  if (/database|postgres|connection|timed?\s*out|timeout|ETIMEDOUT|ECONNREFUSED|query|ECONN|ENOTFOUND|数据库|超时/i.test(message)) {
    return apiError("db_unavailable", "数据库暂时不可用，请稍后再试。", 503);
  }

  // 重复领取（任务奖励/赛季奖励）是幂等冲突而非入参错误：返回 409 + 真实中文消息，
  // 与注册重复的 409 语义对齐（此前落到 400 invalid_input）。
  if (/已经领取|已经被领取|已被领取/i.test(message)) {
    return apiError("conflict", message, 409);
  }

  if (/已经被注册|已经注册|already registered|duplicate|unique|邮箱/i.test(message)) {
    return apiError("conflict", "这个邮箱已经注册过了。", 409);
  }

  return apiError("invalid_input", message || fallbackMessage, 400);
}

export function checkOrigin(request: Request): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;

  // Defense-in-depth CSRF: modern browsers tag a request's relationship to the
  // target site. An explicitly cross-site state-changing request (e.g. a forged
  // POST from a malicious page) is never legitimate here — reject it outright.
  // Legitimate app requests are same-origin / same-site / none.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return apiError("forbidden", "跨站请求不被允许。", 403);
  }

  const origin = request.headers.get("origin");
  const appUrl = env.APP_URL;
  if (!appUrl || !origin) return null;
  const allowed = new URL(appUrl).origin;
  if (origin !== allowed) {
    return apiError("forbidden", "请求来源不被允许。", 403);
  }
  return null;
}
