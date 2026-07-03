import { NextResponse } from "next/server";

import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { learningModules } from "@/lib/content";
import { getLearningProgress, hasModuleQuizPassed, markModuleComplete } from "@/lib/db/repo";
import { recomputePowerForUser } from "@/lib/leaderboard/service";

export const dynamic = "force-dynamic";

const VALID_KEYS = new Set<string>(learningModules.map((m) => m.key));
const schema = z.object({ moduleKey: z.string().min(1).max(48) });

/** Mark a learning module learned only after the student has passed its quiz. */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || !VALID_KEYS.has(parsed.data.moduleKey)) {
      return apiError("invalid_input", "无效的课程模块。", 400);
    }

    const quizPassed = await hasModuleQuizPassed(auth.user.id, parsed.data.moduleKey);
    if (!quizPassed) {
      return apiError("forbidden", "请先通过课后小测，再记录学习完成。", 403);
    }

    await markModuleComplete(auth.user.id, parsed.data.moduleKey);
    await recomputePowerForUser(auth.user.id).catch(() => {});

    const progress = await getLearningProgress(auth.user.id);
    return NextResponse.json({ progress, message: "已记录学习完成，财商战力的学习分已更新。" });
  } catch (error) {
    return handleRouteError(error, "记录学习失败，请稍后再试。");
  }
}
