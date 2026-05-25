import { NextResponse } from "next/server";

import { requestHistoryReviewInsight } from "@/lib/ai";
import { readSession } from "@/lib/auth";
import { buildHistoryReviewAiContext, buildHistoryReviewPayload } from "@/lib/history-review";
import { getSimulationStateForUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await readSession();
    if (!session || session.role !== "student") {
      return NextResponse.json({ error: "需要学生账号登录。" }, { status: 401 });
    }

    const state = getSimulationStateForUser(session.userId);
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "历史复盘暂时不可用。",
      },
      { status: 400 },
    );
  }
}
