import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { handleRouteError } from "@/lib/api-response";
import { getPeerHeatForStudent } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const payload = await getPeerHeatForStudent(auth.user.id);
    return NextResponse.json(
      { payload },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error, "同学热度暂时不可用，请稍后再试。");
  }
}
