import { NextResponse } from "next/server";

import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import {
  getLearningModuleQuizPrompt,
  gradeLearningModuleQuiz,
  learningModules,
} from "@/lib/content";
import { markModuleQuizPassed } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

const VALID_KEYS = new Set<string>(learningModules.map((module) => module.key));
const postSchema = z.object({
  moduleKey: z.string().min(1).max(48),
  answers: z.array(z.number().int().min(0).max(8)).min(1).max(8),
});

export async function GET(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const moduleKey = searchParams.get("moduleKey") ?? "";
  if (!VALID_KEYS.has(moduleKey)) {
    return apiError("invalid_input", "请选择有效的课程模块。", 400);
  }

  const quiz = getLearningModuleQuizPrompt(moduleKey);
  if (!quiz) {
    return apiError("not_found", "没有找到对应课程的小测。", 404);
  }

  return NextResponse.json({ moduleKey, quiz });
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success || !VALID_KEYS.has(parsed.data.moduleKey)) {
      return apiError("invalid_input", "请提交有效的课程模块和答案。", 400);
    }

    const grade = gradeLearningModuleQuiz(parsed.data.moduleKey, parsed.data.answers);
    if (!grade) {
      return apiError("invalid_input", "答案数量和课程小测不匹配，请重新答题。", 400);
    }

    if (grade.passed) {
      await markModuleQuizPassed(auth.user.id, parsed.data.moduleKey);
    }

    return NextResponse.json({
      passed: grade.passed,
      score: grade.score,
    });
  } catch (error) {
    return handleRouteError(error, "小测评分失败，请稍后再试。");
  }
}
