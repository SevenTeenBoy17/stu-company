import { NextResponse } from "next/server";
import { z } from "zod";

import { checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { createAssignmentForTeacher, getTeacherOverview } from "@/lib/db/repo";

// M5: strict boundary types. brief is required so teacher-authored copy is
// never silently replaced by a system default; difficulty is an enum so the
// schema rejects unknown values instead of falling through to "策略".
const assignmentSchema = z.object({
  title: z.string().min(2).max(160),
  brief: z.string().min(10).max(2000),
  difficulty: z.enum(["基础", "策略", "联赛"]).default("策略"),
  dueLabel: z.string().min(2).max(64),
});

export async function GET() {
  const auth = await requireUser("teacher");
  if (auth.error) return auth.error;

  try {
    const overview = await getTeacherOverview(auth.user.id);
    return NextResponse.json({ assignments: overview.assignments });
  } catch (error) {
    return handleRouteError(error, "无法读取班级任务。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("teacher");
  if (auth.error) return auth.error;

  try {
    const body = assignmentSchema.parse(await request.json());
    await createAssignmentForTeacher(auth.user.id, {
      title: body.title,
      brief: body.brief,
      difficulty: body.difficulty,
      dueLabel: body.dueLabel,
    });

    const overview = await getTeacherOverview(auth.user.id);
    return NextResponse.json({
      message: "任务已发布到班级面板。",
      overview,
    });
  } catch (error) {
    return handleRouteError(error, "任务创建失败。");
  }
}
