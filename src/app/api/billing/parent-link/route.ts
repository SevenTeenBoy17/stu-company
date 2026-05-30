import { NextResponse } from "next/server";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { createBillingIntent } from "@/lib/billing/billing-intent";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

function isSharedGuest(user: { id: string; email: string }) {
  return user.id === "guest-student" || user.email.toLowerCase() === "guest@brownzone.ai";
}

/**
 * B1 (conversion): lets a teen generate a shareable link a parent can open to pay
 * the ¥15/月 for them. The student never handles payment (minors-payment
 * compliance) — the link carries a short-lived signed intent that authorizes the
 * parent's prepay for this student. See /api/billing/prepay.
 */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (isSharedGuest(auth.user)) {
    return apiError("forbidden", "请先升级为个人账号，再生成家长付款链接。", 403);
  }

  try {
    const rl = rateLimit(rateLimitKey("parent-link", auth.user.id, request), 8, 60_000 * 10);
    if (!rl.ok) {
      return apiError("invalid_input", buildRateLimitMessage(rl), 429);
    }

    const { token, intent } = await createBillingIntent({
      userId: auth.user.id,
      tier: "standard",
    });

    return NextResponse.json({
      url: `/pricing?upgrade=${encodeURIComponent(token)}`,
      token,
      expiresAt: intent.expiresAt,
      studentName: auth.user.name,
      message: "把这个链接发给家长，家长打开后用微信支付即可为你解锁完整功能。",
    });
  } catch (error) {
    return handleRouteError(error, "生成家长付款链接失败，请稍后重试。");
  }
}
