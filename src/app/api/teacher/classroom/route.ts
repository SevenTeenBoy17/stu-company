import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { getTeacherOverview } from "@/lib/store";

export async function GET() {
  const auth = await requireUser("teacher");
  if (auth.error) return auth.error;

  try {
    const overview = getTeacherOverview(auth.user.id);
    return NextResponse.json({ overview });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法读取班级面板。" },
      { status: 400 },
    );
  }
}
