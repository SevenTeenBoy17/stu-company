import { NextResponse } from "next/server";

import { apiError, checkOrigin, handleRouteError, rateLimitedError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { createBillingIntent } from "@/lib/billing/billing-intent";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

function isSharedGuest(user: { id: string; email: string }) {
  return user.id === "guest-student" || user.email.toLowerCase() === "guest@brownzone.ai";
}

/**
 * B1 (conversion): lets a teen generate a shareable family confirmation link.
 * The student never handles payment (minors-payment
 * compliance) — the link carries a short-lived signed intent that authorizes the
 * parent's prepay for this student. See /api/billing/prepay.
 */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (isSharedGuest(auth.user)) {
    return apiError("forbidden", "请先升级为个人账号，再生成家长确认链接。", 403);
  }

  try {
    const rl = rateLimit(rateLimitKey("parent-link", auth.user.id, request), 8, 60_000 * 10);
    if (!rl.ok) {
      return rateLimitedError(buildRateLimitMessage(rl), rl.retryAfterMs);
    }

    const { token, intent } = await createBillingIntent({
      purpose: "parent-link-prepay",
      userId: auth.user.id,
      tier: "standard",
    });

    return NextResponse.json({
      url: `/pricing?upgrade=${encodeURIComponent(token)}`,
      token,
      expiresAt: intent.expiresAt,
      studentName: auth.user.name,
      message: "可把这个链接交给家长查看，家长确认后即可为你开通完整功能。",
    });
  } catch (error) {
    return handleRouteError(error, "生成家长确认链接失败，请稍后重试。");
  }
}
