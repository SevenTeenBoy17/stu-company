import { NextResponse } from "next/server";

import { apiError, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { requestTutorRadarPayload } from "@/lib/ai";
import { getSimulationStateForUser } from "@/lib/db/repo";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  // H4: radar chart triggers an AI call; protect the same budget.
  const rl = rateLimit(rateLimitKey("ai-radar", auth.user.id, request), 20, 60_000);
  if (!rl.ok) {
    return apiError("service_unavailable", buildRateLimitMessage(rl), 429);
  }

  try {
    const simulation = await getSimulationStateForUser(auth.user.id);
    const radar = await requestTutorRadarPayload({
      state: simulation,
    });

    return NextResponse.json(radar, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, "雷达图生成暂时不可用。");
  }
}
