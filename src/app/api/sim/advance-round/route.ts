import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { advanceRunForUser, getSimulationStateForUser } from "@/lib/store";

export async function POST() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    advanceRunForUser(auth.user.id);
    const state = getSimulationStateForUser(auth.user.id);
    return NextResponse.json({ state, message: "已推进到下一回合。" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "推进回合失败。" },
      { status: 400 },
    );
  }
}
