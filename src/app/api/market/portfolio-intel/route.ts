import { NextResponse } from "next/server";

import { apiError, handleRouteError } from "@/lib/api-response";
import { requestAllocationInsight } from "@/lib/ai";
import { fetchAlltickMarketPulse } from "@/lib/alltick";
import { readSession } from "@/lib/auth";
import { getSimulationStateForUser } from "@/lib/db/repo";
import { buildPortfolioAiContext, buildPortfolioIntel } from "@/lib/portfolio-intel";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await readSession();
    if (!session || session.role !== "student") {
      return apiError("unauthorized", "需要学生账号登录。", 401);
    }

    const state = await getSimulationStateForUser(session.userId);
    const pulse = await fetchAlltickMarketPulse();

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
