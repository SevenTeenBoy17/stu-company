import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { handleRouteError } from "@/lib/api-response";
import { getLearningProgress, getSimulationStateForUser } from "@/lib/db/repo";
import { buildStudentPetPayload } from "@/lib/pet-rewards";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const [state, learning] = await Promise.all([
      getSimulationStateForUser(auth.user.id),
      getLearningProgress(auth.user.id),
    ]);

    return NextResponse.json({
      payload: buildStudentPetPayload(state.run, learning),
    });
  } catch (error) {
    return handleRouteError(error, "萌宠奖励暂时加载失败，请稍后重试。");
  }
}
