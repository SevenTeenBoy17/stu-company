import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { persistSession } from "@/lib/auth";
import { authenticateUser, roleHomePath } from "@/lib/db/repo";
import { buildRateLimitMessage, peekRateLimit, rateLimit, rateLimitKey } from "@/lib/rate-limit";

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

    // (1) Per-account window — stops single-account brute force.
    const rl = rateLimit(rateLimitKey("login-account", body.email.toLowerCase(), request), 12, 60_000 * 10);
    if (!rl.ok) {
      return apiError("invalid_input", buildRateLimitMessage(rl), 429);
    }

    // (2) Per-IP failure budget — stops password spraying across many accounts
    // from one IP. Peek (don't consume) so a successful login never costs a slot.
    const ipFailureKey = rateLimitKey("login-ip-fail", undefined, request);
    if (!peekRateLimit(ipFailureKey, LOGIN_IP_FAILURE_LIMIT)) {
      return apiError("invalid_input", "登录尝试过于频繁，请稍后再试。", 429);
    }

    const user = await authenticateUser(body.email.toLowerCase(), body.password);

    if (!user) {
      // Only failures consume the IP budget.
      rateLimit(ipFailureKey, LOGIN_IP_FAILURE_LIMIT, 60_000 * 10);
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
