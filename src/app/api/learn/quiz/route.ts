import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { apiError } from "@/lib/api-response";
import { publicQuiz } from "@/lib/learning-quiz";

export const dynamic = "force-dynamic";

/** A module's quiz questions WITHOUT the answer key (Option B). */
export async function GET(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  const moduleKey = new URL(request.url).searchParams.get("moduleKey");
  if (!moduleKey) return apiError("invalid_input", "缺少 moduleKey 参数。", 400);

  const questions = publicQuiz(moduleKey);
  if (!questions) return apiError("not_found", "该模块暂无测验。", 404);

  return NextResponse.json({ moduleKey, questions });
}
