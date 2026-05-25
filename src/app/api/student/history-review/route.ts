import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-response";
import { requestHistoryReviewInsight } from "@/lib/ai";
import { readSession } from "@/lib/auth";
import { getSimulationStateForUser } from "@/lib/db/repo";
import { buildHistoryReviewAiContext, buildHistoryReviewPayload } from "@/lib/history-review";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await readSession();
    if (!session || session.role !== "student") {
      return NextResponse.json({ error: "unauthorized", message: "需要学生账号登录。" }, { status: 401 });
    }

    const state = await getSimulationStateForUser(session.userId);
    const basePayload = buildHistoryReviewPayload(state);
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
