import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { getTeacherOverview } from "@/lib/db/repo";

export async function GET() {
  const auth = await requireUser("teacher");
  if (auth.error) return auth.error;

  try {
    const overview = await getTeacherOverview(auth.user.id);
    return NextResponse.json({ overview });
  } catch (error) {
    return handleRouteError(error, "无法读取班级面板。");
  }
}
