import { NextResponse } from "next/server";
import { z } from "zod";

import { checkOrigin, handleRouteError, rateLimitedError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { requestOnboardingNarrative } from "@/lib/ai";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";

const onboardingSchema = z.object({
  stepId: z.string().min(1).max(80),
  stepTitle: z.string().min(1).max(80),
  concept: z.string().min(1).max(80),
  fallbackText: z.string().min(10).max(600),
  progressLabel: z.string().min(1).max(40),
});

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  const rl = rateLimit(rateLimitKey("ai-onboarding", auth.user.id, request), 12, 60_000);
  if (!rl.ok) {
    return rateLimitedError(buildRateLimitMessage(rl), rl.retryAfterMs);
  }

  try {
    const body = onboardingSchema.parse(await request.json());
    const reply = await requestOnboardingNarrative({
      userName: auth.user.name,
      ...body,
    });

    return NextResponse.json({
      text: reply.text,
      provider: reply.provider,
      baseUrl: reply.baseUrl,
      message: reply.provider === "remote" ? "已生成 AI 新手教学。" : "已切换到本地教学脚本。",
    });
  } catch (error) {
    return handleRouteError(error, "AI 新手教学暂时不可用。");
  }
}
