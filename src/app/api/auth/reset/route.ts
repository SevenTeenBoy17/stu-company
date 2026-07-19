import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError, rateLimitedError } from "@/lib/api-response";
import { updateUserPassword } from "@/lib/db/repo";
import { verifyPasswordResetToken } from "@/lib/password-reset";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

const resetSchema = z.object({
  token: z.string().min(20),
  password: z
    .string()
    .min(8, "密码至少 8 位。")
    .regex(/[a-zA-Z]/, "密码需要包含至少一个字母。")
    .regex(/\d/, "密码需要包含至少一个数字。"),
});

/**
 * A2: completes a password reset. updateUserPassword bumps tokenVersion, which
 * revokes any outstanding session JWTs (so a leaked old session can't survive a
 * reset).
 */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const rl = rateLimit(rateLimitKey("reset-password", undefined, request), 10, 60_000 * 10);
    if (!rl.ok) {
      return rateLimitedError(buildRateLimitMessage(rl), rl.retryAfterMs);
    }

    const body = resetSchema.parse(await request.json());
    const claims = await verifyPasswordResetToken(body.token);
    if (!claims) {
      return apiError("invalid_input", "重置链接无效或已过期，请重新发起。", 400);
    }

    await updateUserPassword(claims.userId, body.password);

    return NextResponse.json({ message: "密码已重置，请用新密码登录。" });
  } catch (error) {
    return handleRouteError(error, "重置密码失败，请稍后重试。");
  }
}
