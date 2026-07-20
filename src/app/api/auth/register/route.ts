import { NextResponse } from "next/server";

import { apiError, checkOrigin, handleRouteError, rateLimitedError } from "@/lib/api-response";
import { registerSchema } from "@/lib/auth-validation";
import { persistSession } from "@/lib/auth";
import { registerUserByEmail, roleHomePath } from "@/lib/db/repo";
import { sendEmail, verificationEmail } from "@/lib/email";
import { createEmailVerificationToken } from "@/lib/email-verification";
import { buildRateLimitMessage, registerRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const rl = registerRateLimit(request);
    if (!rl.ok) {
      return rateLimitedError(buildRateLimitMessage(rl), rl.retryAfterMs);
    }

    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) {
      // Surface the schema's specific Chinese message (e.g. "密码需要包含至少一个数字。")
      // instead of the generic handleRouteError fallback, so the user knows what
      // to fix rather than blindly retrying into the rate limiter.
      const message = parsed.error.issues[0]?.message ?? "请求参数格式不正确，请检查后重试。";
      return apiError("invalid_input", message, 400);
    }
    const body = parsed.data;
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
