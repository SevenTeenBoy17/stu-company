import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { requestTutorRadarPayload } from "@/lib/ai";
import { getSimulationStateForUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const simulation = getSimulationStateForUser(auth.user.id);
    const radar = await requestTutorRadarPayload({
      state: simulation,
    });

    return NextResponse.json(radar, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "雷达图生成暂时不可用。" },
      { status: 400 },
    );
  }
}
