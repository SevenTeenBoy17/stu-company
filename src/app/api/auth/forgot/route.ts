import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { findUserByEmail } from "@/lib/db/repo";
import { passwordResetEmail, sendEmail } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/password-reset";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

const forgotSchema = z.object({
  email: z.string().trim().email("请输入有效的邮箱地址。").max(255),
});

/**
 * A2: starts a self-service password reset. Always returns the same generic
 * message whether or not the email exists (anti-enumeration). The reset link is
 * surfaced in the response only outside production until an email provider is
 * wired — TODO(email-provider): deliver resetUrl to the user's inbox instead.
 */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const rl = rateLimit(rateLimitKey("forgot-password", undefined, request), 5, 60_000 * 10);
    if (!rl.ok) {
      return apiError("invalid_input", buildRateLimitMessage(rl), 429);
    }

    const { email } = forgotSchema.parse(await request.json());
    const normalizedEmail = email.toLowerCase();
    const user = await findUserByEmail(normalizedEmail);

    let resetUrl: string | undefined;
    if (user) {
      const token = await createPasswordResetToken(user.id, user.email);
      const link = new URL(
        `/reset-password?token=${encodeURIComponent(token)}`,
        request.url,
      ).toString();
      const mail = passwordResetEmail(user.name, link);
      const delivery = await sendEmail({ to: user.email, subject: mail.subject, html: mail.html });
      // Surface the raw link only when delivery wasn't possible (dev / unconfigured).
      if (!delivery.delivered) resetUrl = link;
    }

    return NextResponse.json({
      message: "如果该邮箱已注册，我们已生成密码重置链接，请查收邮箱。",
      resetUrl,
    });
  } catch (error) {
    return handleRouteError(error, "发起密码重置失败，请稍后重试。");
  }
}
