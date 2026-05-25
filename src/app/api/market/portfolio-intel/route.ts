import { NextResponse } from "next/server";

import { requestAllocationInsight } from "@/lib/ai";
import { readSession } from "@/lib/auth";
import { fetchAlltickMarketPulse } from "@/lib/alltick";
import { buildPortfolioAiContext, buildPortfolioIntel } from "@/lib/portfolio-intel";
import { getSimulationStateForUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await readSession();
    if (!session || session.role !== "student") {
      return NextResponse.json({ error: "需要学生账号登录。" }, { status: 401 });
    }

    const state = getSimulationStateForUser(session.userId);
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "资产配置面板暂时不可用。",
      },
      { status: 400 },
    );
  }
}
