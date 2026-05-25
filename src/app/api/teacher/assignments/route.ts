import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { createAssignmentForTeacher, getTeacherOverview } from "@/lib/store";

const assignmentSchema = z.object({
  title: z.string().min(2),
  brief: z.string().min(10).optional(),
  summary: z.string().min(10).optional(),
  difficulty: z.string().min(1).optional(),
  dueLabel: z.string().min(2),
});

function normalizeDifficulty(value?: string) {
  if (value === "基础" || value === "策略" || value === "联赛") {
    return value;
  }

  return "策略";
}

export async function GET() {
  const auth = await requireUser("teacher");
  if (auth.error) return auth.error;

  const overview = getTeacherOverview(auth.user.id);
  return NextResponse.json({ assignments: overview.assignments });
}

export async function POST(request: Request) {
  const auth = await requireUser("teacher");
  if (auth.error) return auth.error;

  try {
    const body = assignmentSchema.parse(await request.json());
    createAssignmentForTeacher(auth.user.id, {
      title: body.title,
      brief: body.brief ?? body.summary ?? "请围绕本周市场情景完成一次复盘与策略说明。",
      difficulty: normalizeDifficulty(body.difficulty) as "基础" | "策略" | "联赛",
      dueLabel: body.dueLabel,
    });

    const overview = getTeacherOverview(auth.user.id);
    return NextResponse.json({
      message: "任务已发布到班级面板。",
      overview,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "任务创建失败。" },
      { status: 400 },
    );
  }
}
