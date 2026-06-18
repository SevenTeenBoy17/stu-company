import { NextResponse } from "next/server";

import { requestBehaviorPersona } from "@/lib/ai";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import {
  getLearningProgress,
  getRiskProfile,
  getSimulationStateForUser,
  upsertRiskProfile,
  type RiskProfileRecord,
} from "@/lib/db/repo";
import { buildPersonaSignalInput, personaInputDigest } from "@/lib/behavior-persona";

export const dynamic = "force-dynamic";

function readQuestionnaireScore(profile: RiskProfileRecord | null): number | undefined {
  const score = profile?.answers?.score;
  return typeof score === "number" && Number.isFinite(score) ? score : undefined;
}

function fallbackAnswers(analyzedAt: string) {
  return {
    behaviorOnly: true,
    generatedAt: analyzedAt,
    source: "behavior-re-evaluation",
  };
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  try {
    const auth = await requireUser("student");
    if (auth.error) return auth.error;

    const [state, learning, existingProfile] = await Promise.all([
      getSimulationStateForUser(auth.user.id),
      getLearningProgress(auth.user.id),
      getRiskProfile(auth.user.id),
    ]);

    const input = buildPersonaSignalInput(
      state.run,
      learning,
      readQuestionnaireScore(existingProfile),
    );
    const inputDigest = personaInputDigest(input);

    if (
      existingProfile?.behaviorPersona &&
      existingProfile.inputDigest === inputDigest
    ) {
      return NextResponse.json({
        persona: existingProfile.behaviorPersona,
        provider: existingProfile.personaProvider ?? "stored",
        analyzedAt: existingProfile.analyzedAt,
        cached: true,
      });
    }

    const { persona, provider } = await requestBehaviorPersona(input);
    const analyzedAt = new Date().toISOString();

    await upsertRiskProfile(auth.user.id, {
      riskLabel: existingProfile?.riskLabel ?? persona.label,
      answers: existingProfile?.answers ?? fallbackAnswers(analyzedAt),
      behaviorPersona: persona,
      personaProvider: provider,
      analyzedAt,
      inputDigest,
    });

    return NextResponse.json({
      persona,
      provider,
      analyzedAt,
      cached: false,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return apiError("invalid_input", "请求内容格式不正确，请刷新后重试。", 400);
    }
    return handleRouteError(error, "行为复评暂时不可用，请稍后重试。");
  }
}
