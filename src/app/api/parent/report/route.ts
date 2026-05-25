import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { getParentOverview } from "@/lib/store";

export async function GET() {
  const auth = await requireUser("parent");
  if (auth.error) return auth.error;

  try {
    const overview = getParentOverview(auth.user.id);
    return NextResponse.json({ overview });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法读取成长报告。" },
      { status: 400 },
    );
  }
}
