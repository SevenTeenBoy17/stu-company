import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { getLearningProgress } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

/**
 * The caller's learning completion (for the catalog 打卡 controls). Public-safe:
 * the catalog lives on the public `/learn` page, so an anonymous or non-student
 * visitor gets an empty result with 200 rather than a 401 — the page just hides
 * its progress controls, and the browser never logs an auth error for a guest.
 */
export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) {
    return NextResponse.json({ progress: null });
  }
  const progress = await getLearningProgress(auth.user.id);
  return NextResponse.json({ progress });
}
