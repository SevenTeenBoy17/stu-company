import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { requestHistoryReviewInsight } from "@/lib/ai";
import { evaluatePersonalAiAccess, resolveSubscriptionState } from "@/lib/billing/subscription";
import { getSimulationStateForUser } from "@/lib/db/repo";
import { isEmailVerificationRequired } from "@/lib/email-verification";
import { buildHistoryReviewAiContext, buildHistoryReviewPayload } from "@/lib/history-review";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireUser("student");
    if (auth.error) return auth.error;

    const state = await getSimulationStateForUser(auth.user.id);
    const basePayload = buildHistoryReviewPayload(state);
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
      const gateNote =
        access.reason === "verify"
          ? "请先验证邮箱即可解锁完整 AI 历史复盘，当前展示本地教学版总结。"
          : "当前账号暂未开通完整 AI 历史复盘，已展示本地教学版总结。";
      return NextResponse.json(
        buildHistoryReviewPayload(state, {
          ...basePayload.aiReview,
          provider: "fallback",
          summary: `${basePayload.aiReview.summary} ${gateNote}`,
        }),
        {
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    const aiReview = await requestHistoryReviewInsight({
      state,
      contextBlock: buildHistoryReviewAiContext(state, basePayload),
      fallbackReview: basePayload.aiReview,
    });

    return NextResponse.json(buildHistoryReviewPayload(state, aiReview), {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, "历史复盘暂时不可用。");
  }
}
