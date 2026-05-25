import { NextResponse } from "next/server";
import { ZodError } from "zod";

type ApiErrorCode =
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "db_unavailable"
  | "service_unavailable";

export function apiError(error: ApiErrorCode, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export function handleRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) {
    return apiError("invalid_input", "请求参数格式不正确，请检查后重试。", 400);
  }

  const message = error instanceof Error ? error.message : fallbackMessage;

  if (/database|postgres|connection|timeout|query|ECONN|ENOTFOUND|数据库/i.test(message)) {
    return apiError("db_unavailable", "数据库暂时不可用，请稍后再试。", 503);
  }

  if (/已经被注册|already registered|duplicate|unique/i.test(message)) {
    return apiError("conflict", message, 409);
  }

  return apiError("invalid_input", message || fallbackMessage, 400);
}
