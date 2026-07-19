import { NextResponse } from "next/server";

import { apiError, checkOrigin, handleRouteError, rateLimitedError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { requestTutorRadarPayload } from "@/lib/ai";
import { evaluatePersonalAiAccess, resolveSubscriptionState } from "@/lib/billing/subscription";
import { isEmailVerificationRequired } from "@/lib/email-verification";
import { deriveInvestorPersona } from "@/lib/simulation";
import { getSimulationStateForUser } from "@/lib/db/repo";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  const subscription = resolveSubscriptionState(
    auth.user.subscriptionTier,
    auth.user.trialExpiresAt,
    auth.user.subscriptionExpiresAt,
  );
  const access = evaluatePersonalAiAccess(subscription, {
    emailVerified: Boolean(auth.user.emailVerifiedAt),
    requireVerification: isEmailVerificationRequired(),
  });
  if (!access.ok) {
    return apiError(
      "forbidden",
      access.reason === "verify"
        ? "请先验证邮箱后再生成 AI 雷达图（查收注册时发送的验证邮件）。"
        : subscription.bannerMessage ?? "当前账号暂未开通完整 AI 雷达图生成。",
      403,
    );
  }

  // H4: radar chart triggers an AI call; protect the same budget.
  const rl = rateLimit(rateLimitKey("ai-radar", auth.user.id, request), 20, 60_000);
  if (!rl.ok) {
    return rateLimitedError(buildRateLimitMessage(rl), rl.retryAfterMs);
  }

  try {
    const simulation = await getSimulationStateForUser(auth.user.id);
    const radar = await requestTutorRadarPayload({
      state: simulation,
    });

    // Premium deep report: a deterministic investor-personality card. Standard
    // users get the radar only; Premium also gets `persona`.
    const persona = subscription.features.deepAiReport
      ? deriveInvestorPersona(simulation.run)
      : null;

    return NextResponse.json(
      { ...radar, persona, deepReport: subscription.features.deepAiReport },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error, "雷达图生成暂时不可用。");
  }
}
