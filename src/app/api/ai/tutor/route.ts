import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { requestTutorInsight } from "@/lib/ai";
import { getSimulationStateForUser } from "@/lib/db/repo";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

const tutorSchema = z.object({
  mode: z.enum(["welcome", "action-review", "round-review", "parent-summary"]).default("round-review"),
  prompt: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  // H4: tutor is cheaper per call than chat but still hits the AI gateway.
  const rl = rateLimit(rateLimitKey("ai-tutor", auth.user.id, request), 20, 60_000);
  if (!rl.ok) {
    return apiError("service_unavailable", buildRateLimitMessage(rl), 429);
  }

  try {
    const body = tutorSchema.parse(await request.json());
    const simulation = await getSimulationStateForUser(auth.user.id);
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
      message: insight.provider === "remote" ? "已获得 AI 导师点评。" : "已返回本地兜底点评。",
    });
  } catch (error) {
    return handleRouteError(error, "AI 导师暂时不可用。");
  }
}
