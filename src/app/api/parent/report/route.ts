import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { getParentOverview } from "@/lib/db/repo";

export async function GET() {
  const auth = await requireUser("parent");
  if (auth.error) return auth.error;

  try {
    const overview = await getParentOverview(auth.user.id);
    return NextResponse.json({ overview });
  } catch (error) {
    return handleRouteError(error, "无法读取成长报告。");
  }
}
