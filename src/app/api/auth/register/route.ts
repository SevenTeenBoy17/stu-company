import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { persistSession } from "@/lib/auth";
import { registerUserByEmail, roleHomePath } from "@/lib/db/repo";
import { sendEmail, verificationEmail } from "@/lib/email";
import { createEmailVerificationToken } from "@/lib/email-verification";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(2, "昵称至少需要 2 个字符。").max(16, "昵称最多 16 个字符。"),
  email: z.string().trim().email("请输入有效的邮箱地址。").max(255),
  password: z
    .string()
    .min(8, "密码至少 8 位。")
    .regex(/[a-zA-Z]/, "密码需要包含至少一个字母。")
    .regex(/\d/, "密码需要包含至少一个数字。"),
  inviteCode: z.string().min(6).optional(),
});

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const rlKey = rateLimitKey("register", undefined, request);
    const rl = rateLimit(rlKey, 5, 60_000 * 10);
    if (!rl.ok) {
      return apiError("invalid_input", buildRateLimitMessage(rl), 429);
    }

    const body = registerSchema.parse(await request.json());
    const user = await registerUserByEmail({ ...body, email: body.email.toLowerCase() });

    await persistSession({
      userId: user.id,
      role: user.role,
      email: user.email,
      classroomId: user.classroomId ?? null,
      tv: user.tokenVersion ?? 0,
    });

    // A1: mint an email-verification link and deliver it via Resend. When email
    // is not configured (dev), the link is returned in the response so the user
    // can still self-confirm. Verification is not enforced, so users are never
    // blocked if email delivery is unavailable.
    const verificationToken = await createEmailVerificationToken(user.id, user.email);
    const verifyUrl = new URL(
      `/api/auth/verify?token=${encodeURIComponent(verificationToken)}`,
      request.url,
    ).toString();
    const mail = verificationEmail(user.name, verifyUrl);
    const delivery = await sendEmail({ to: user.email, subject: mail.subject, html: mail.html });

    return NextResponse.json({
      redirectTo: roleHomePath(user.role),
      message: delivery.delivered
        ? "注册成功，验证邮件已发送，请查收邮箱。"
        : "注册成功，欢迎加入 Mr.Brown 经济沙盘。",
      // Surface the raw link ONLY in non-production AND when delivery failed.
      // Never in production, even if email is misconfigured — returning a working
      // token in the response body would be an account-takeover vector.
      verifyUrl:
        process.env.NODE_ENV !== "production" && !delivery.delivered ? verifyUrl : undefined,
    });
  } catch (error) {
    return handleRouteError(error, "注册失败。");
  }
}
