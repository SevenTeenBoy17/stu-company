import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { requestTutorInsight } from "@/lib/ai";
import { getSimulationStateForUser } from "@/lib/store";

const tutorSchema = z.object({
  mode: z.enum(["welcome", "action-review", "round-review", "parent-summary"]).default("round-review"),
  prompt: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const body = tutorSchema.parse(await request.json());
    const simulation = getSimulationStateForUser(auth.user.id);
    const insight = await requestTutorInsight({
      mode: body.mode,
      prompt: body.prompt,
      state: {
        user: simulation.user,
        market: simulation.market,
        run: simulation.run,
      },
    });

    return NextResponse.json({
      text: insight.text,
      provider: insight.provider,
      baseUrl: insight.baseUrl,
      message: insight.provider === "remote" ? "已获取 AI 导师点评。" : "已返回本地兜底点评。",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 导师暂时不可用。" },
      { status: 400 },
    );
  }
}
