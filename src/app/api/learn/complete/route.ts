import { NextResponse } from "next/server";

import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { getLearningProgress, markModuleComplete } from "@/lib/db/repo";
import { gradeQuiz } from "@/lib/learning-quiz";
import { recomputePowerForUser } from "@/lib/leaderboard/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  moduleKey: z.string().min(1).max(48),
  answers: z.array(z.number().int()).max(20),
});

/**
 * Submit a module quiz (Option B). Graded server-side; only a pass (>= 2/3)
 * marks the module learned and refreshes 战力. A fail returns the score so the
 * student can retry.
 */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("invalid_input", "提交格式不正确。", 400);
    }

    const result = gradeQuiz(parsed.data.moduleKey, parsed.data.answers);
    if (!result) {
      return apiError("invalid_input", "无效的课程模块。", 400);
    }

    if (!result.passed) {
      return NextResponse.json({
        passed: false,
        correct: result.correct,
        total: result.total,
        message: `答对 ${result.correct}/${result.total}，再复习一下重新挑战～`,
      });
    }

    await markModuleComplete(auth.user.id, parsed.data.moduleKey);
    await recomputePowerForUser(auth.user.id).catch(() => {});

    const progress = await getLearningProgress(auth.user.id);
    return NextResponse.json({
      passed: true,
      correct: result.correct,
      total: result.total,
      progress,
      message: "测验通过，已记录学完，财商战力的学习分已更新。",
    });
  } catch (error) {
    return handleRouteError(error, "提交测验失败，请稍后再试。");
  }
}
