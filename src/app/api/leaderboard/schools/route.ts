import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { apiError } from "@/lib/api-response";
import { listSchoolsByCity } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

/** Schools already registered in ?cityCode= (self-input, deduped). */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const cityCode = new URL(request.url).searchParams.get("cityCode");
  if (!cityCode) return apiError("invalid_input", "缺少 cityCode 参数。", 400);

  const schools = await listSchoolsByCity(cityCode);
  return NextResponse.json({
    schools: schools.map((s) => ({ id: s.id, name: s.name })),
  });
}
