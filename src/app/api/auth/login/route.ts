import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { persistSession } from "@/lib/auth";
import { authenticateUser, roleHomePath } from "@/lib/db/repo";
import { clientIpFrom, peekRateLimit, rateLimit, rateLimitKey } from "@/lib/rate-limit";

// Per-IP failed-login budget over 10 min. Tolerant enough for a whole classroom
// behind one school NAT IP (only FAILURES count, not successful logins), but low
// enough to throttle password spraying (1 password × many accounts from one IP).
const LOGIN_IP_FAILURE_LIMIT = 50;
const INVALID_LOGIN_MESSAGE = "账号或密码错误，请重新输入。";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .max(255)
    .refine(
      (value) =>
        value.toLowerCase() === "superadmin" || z.string().email().safeParse(value).success,
      "请输入有效邮箱，或输入超级管理员账号 superadmin。",
    ),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const parsed = loginSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return apiError("unauthorized", INVALID_LOGIN_MESSAGE, 401);
    }

    const body = parsed.data;

    // (1) Per-account brute-force window, keyed by (email + client IP) and PEEK-based
    // (itest6 R3 P2): the old email-only key + consume-on-every-attempt let anyone lock a
    // victim's (enumerable) account for 10 min with 12 wrong passwords — the correct password
    // got 429 too (targeted login DoS). Keying by email+IP means an attacker only burns their
    // OWN IP's budget for that account; the real user on another IP is unaffected. Peek here so
    // a correct password never costs a slot — only failures consume (see below).
    const accountKey = `login-account:${body.email.toLowerCase()}:${clientIpFrom(request)}`;
    if (!peekRateLimit(accountKey, 12)) {
      return apiError("invalid_input", "登录尝试过于频繁，请稍后再试。", 429);
    }

    // (2) Per-IP failure budget — stops password spraying across many accounts
    // from one IP. Peek (don't consume) so a successful login never costs a slot.
    const ipFailureKey = rateLimitKey("login-ip-fail", undefined, request);
    if (!peekRateLimit(ipFailureKey, LOGIN_IP_FAILURE_LIMIT)) {
      return apiError("invalid_input", "登录尝试过于频繁，请稍后再试。", 429);
    }

    const user = await authenticateUser(body.email.toLowerCase(), body.password);

    if (!user) {
      // Only failures consume budgets — a correct password is never throttled by prior failures.
      rateLimit(ipFailureKey, LOGIN_IP_FAILURE_LIMIT, 60_000 * 10);
      rateLimit(accountKey, 12, 60_000 * 10);
      return apiError("unauthorized", INVALID_LOGIN_MESSAGE, 401);
    }

    await persistSession({
      userId: user.id,
      role: user.role,
      email: user.email,
      classroomId: user.classroomId ?? null,
      tv: user.tokenVersion ?? 0,
    });

    return NextResponse.json({
      redirectTo: roleHomePath(user.role),
      message: "登录成功。",
    });
  } catch (error) {
    return handleRouteError(error, "登录失败。");
  }
}
