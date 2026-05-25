import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { getSimulationStateForUser } from "@/lib/db/repo";

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({ state });
  } catch (error) {
    return handleRouteError(error, "无法读取当前沙盘，请稍后再试。");
  }
}
