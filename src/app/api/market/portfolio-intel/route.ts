import { NextResponse } from "next/server";

import { apiError, handleRouteError, rateLimitedError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { requestAllocationInsight } from "@/lib/ai";
import { fetchAlltickMarketPulse } from "@/lib/alltick";
import { fetchItickMarketPulse } from "@/lib/itick";
import { evaluatePersonalAiAccess, resolveSubscriptionState } from "@/lib/billing/subscription";
import { getSimulationStateForUser } from "@/lib/db/repo";
import { isEmailVerificationRequired } from "@/lib/email-verification";
import { buildPortfolioAiContext, buildPortfolioIntel } from "@/lib/portfolio-intel";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
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
          ? "请先验证邮箱后再使用 AI 配置建议（查收注册时发送的验证邮件）。"
          : subscription.bannerMessage ?? "当前账号暂未开通完整 AI 配置建议。",
        403,
      );
    }

    // H4: portfolio intel goes through the AI gateway too.
    const rl = rateLimit(rateLimitKey("ai-intel", auth.user.id, request), 20, 60_000);
    if (!rl.ok) {
      return rateLimitedError(buildRateLimitMessage(rl), rl.retryAfterMs);
    }

    const state = await getSimulationStateForUser(auth.user.id);
    const itickPulse = await fetchItickMarketPulse();
    const pulse =
      itickPulse.signals.length > 0 ? itickPulse : await fetchAlltickMarketPulse();

    const baseIntel = buildPortfolioIntel(state, {
      asOf: pulse.asOf,
      marketSignals: pulse.signals,
      marketNote: pulse.note,
    });

    const reply = await requestAllocationInsight({
      state,
      contextBlock: buildPortfolioAiContext(state, baseIntel),
      fallbackText: baseIntel.coachNote,
    });

    return NextResponse.json(
      buildPortfolioIntel(state, {
        asOf: pulse.asOf,
        marketSignals: pulse.signals,
        marketNote: pulse.note,
        coachNote: reply.text,
        coachProvider: reply.provider,
      }),
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error, "资产配置面板暂时不可用。");
  }
}
