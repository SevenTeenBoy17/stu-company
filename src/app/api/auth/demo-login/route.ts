import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError, rateLimitedError } from "@/lib/api-response";
import { persistSession } from "@/lib/auth";
import { authenticateUser, getQuickDemoCredentials, roleHomePath } from "@/lib/db/repo";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

// One-click demo login. The client sends ONLY the email of a built-in demo
// account; the password never leaves the server (it is looked up here from the
// canonical demo-credentials list). This keeps demo passwords out of the public
// /demo RSC payload while preserving the one-click experience.
const schema = z.object({ email: z.string().trim().toLowerCase().max(255) });

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError("invalid_input", "演示账号无效。", 400);
    }
    const email = parsed.data.email;

    const rl = rateLimit(rateLimitKey("demo-login", email, request), 20, 60_000 * 10);
    if (!rl.ok) {
      return rateLimitedError(buildRateLimitMessage(rl), rl.retryAfterMs);
    }

    // Only the built-in demo accounts may use one-click login.
    const credential = getQuickDemoCredentials().find((item) => item.email.toLowerCase() === email);
    if (!credential) {
      return apiError("forbidden", "仅支持内置演示账号一键登录，请使用邮箱登录。", 403);
    }

    const user = await authenticateUser(credential.email.toLowerCase(), credential.password);
    if (!user) {
      return apiError("service_unavailable", "演示账号尚未就绪，请先初始化种子数据（npm run db:seed）。", 503);
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
      message: "已进入演示账号。",
    });
  } catch (error) {
    return handleRouteError(error, "演示登录失败。");
  }
}
