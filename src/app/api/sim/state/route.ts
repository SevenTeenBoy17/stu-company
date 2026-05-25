import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { getSimulationStateForUser } from "@/lib/store";

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const state = getSimulationStateForUser(auth.user.id);
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法读取当前沙盘。" },
      { status: 400 },
    );
  }
}
