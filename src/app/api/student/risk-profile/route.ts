import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { getRiskProfile, getSimulationStateForUser, upsertRiskProfile } from "@/lib/db/repo";
import { buildRiskProfilePayload, riskProfileQuestions, type RiskProfileAnswer } from "@/lib/risk-profile";

export const dynamic = "force-dynamic";

const answerSchema = z.object({
  questionId: z.string().min(1),
  optionId: z.string().min(1),
});

const requestSchema = z.object({
  answers: z.array(answerSchema).min(1).max(riskProfileQuestions.length),
});

function sanitizeAnswers(input: z.infer<typeof requestSchema>["answers"]): RiskProfileAnswer[] {
  return input.map((answer) => {
    const question = riskProfileQuestions.find((item) => item.id === answer.questionId);
    const option = question?.options.find((item) => item.id === answer.optionId);
    if (!question || !option) {
      throw new Error("测评选项不存在，请刷新页面后重试。");
    }
    return {
      questionId: question.id,
      optionId: option.id,
    };
  });
}

function readSavedAnswers(input: Record<string, unknown> | undefined): RiskProfileAnswer[] | undefined {
  const parsed = z.array(answerSchema).safeParse(input?.selectedAnswers);
  if (!parsed.success || parsed.data.length === 0) return undefined;
  return sanitizeAnswers(parsed.data);
}

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const [state, savedProfile] = await Promise.all([
      getSimulationStateForUser(auth.user.id),
      getRiskProfile(auth.user.id),
    ]);
    const savedAnswers = readSavedAnswers(savedProfile?.answers);
    const savedAt = savedProfile?.updatedAt ? new Date(savedProfile.updatedAt) : undefined;

    return NextResponse.json({
      payload: savedAnswers && savedAt
        ? buildRiskProfilePayload(state.run, savedAnswers, savedAt)
        : buildRiskProfilePayload(state.run),
      persisted: Boolean(savedAnswers),
    });
  } catch (error) {
    return handleRouteError(error, "风险测评暂时不可用，请稍后再试。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("invalid_input", "请选择完整的测评答案后再生成画像。", 400);
    }

    const answers = sanitizeAnswers(parsed.data.answers);
    const state = await getSimulationStateForUser(auth.user.id);
    const payload = buildRiskProfilePayload(state.run, answers);

    await upsertRiskProfile(auth.user.id, {
      riskLabel: payload.label,
      answers: {
        selectedAnswers: payload.selectedAnswers,
        score: payload.score,
        band: payload.band,
        generatedAt: payload.generatedAt,
      },
    });

    return NextResponse.json({
      payload,
      persisted: true,
    });
  } catch (error) {
    return handleRouteError(error, "风险测评提交失败，请稍后再试。");
  }
}
