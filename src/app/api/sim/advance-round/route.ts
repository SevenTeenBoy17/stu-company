import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { advanceRunForUser, getSimulationStateForUser } from "@/lib/db/repo";

export async function POST() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    await advanceRunForUser(auth.user.id);
    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({ state, message: "已推进到下一回合。" });
  } catch (error) {
    return handleRouteError(error, "推进回合失败，请稍后再试。");
  }
}
