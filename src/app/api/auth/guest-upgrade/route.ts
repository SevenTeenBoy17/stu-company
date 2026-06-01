import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { persistSession } from "@/lib/auth";
import { createBillingIntent } from "@/lib/billing/billing-intent";
import { registerUserByEmail } from "@/lib/db/repo";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";
import type { GuestUpgradeResult } from "@/lib/types";

const guestUpgradeSchema = z.object({
  name: z.string().trim().min(2, "昵称至少需要 2 个字符。").max(16, "昵称最多 16 个字符。"),
  email: z.string().trim().email("请输入有效的邮箱地址。").max(255),
  password: z
    .string()
    .min(8, "密码至少 8 位。")
    .regex(/[a-zA-Z]/, "密码需要包含至少一个字母。")
    .regex(/\d/, "密码需要包含至少一个数字。"),
});

function isSharedGuest(user: { id: string; email: string }) {
  return user.id === "guest-student" || user.email.toLowerCase() === "guest@brownzone.ai";
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isSharedGuest(auth.user)) {
    return apiError("forbidden", "只有游客体验账号需要先升级为个人账号。", 403);
  }

  try {
    const rl = rateLimit(rateLimitKey("guest-upgrade", auth.user.id, request), 5, 60_000 * 10);
    if (!rl.ok) {
      return apiError("invalid_input", buildRateLimitMessage(rl), 429);
    }

    const body = guestUpgradeSchema.parse(await request.json());
    const user = await registerUserByEmail({
      name: body.name,
      email: body.email.toLowerCase(),
      password: body.password,
    });

    await persistSession({
      userId: user.id,
      role: user.role,
      email: user.email,
      classroomId: user.classroomId ?? null,
      tv: user.tokenVersion ?? 0,
    });

    const { token, intent } = await createBillingIntent({
      userId: user.id,
      tier: "standard",
    });

    const result: GuestUpgradeResult = {
      redirectTo: "/student",
      billingIntentToken: token,
      billingIntent: intent,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        trialExpiresAt: user.trialExpiresAt,
        subscriptionTier: user.subscriptionTier,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "游客升级失败，请稍后重试。");
  }
}
