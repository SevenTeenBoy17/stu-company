import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { getLearningProgress } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

/** The caller's learning completion (for the catalog 打卡 controls). */
export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;
  const progress = await getLearningProgress(auth.user.id);
  return NextResponse.json({ progress });
}
