import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { citiesOf, provinces } from "@/lib/leaderboard/regions";

export const dynamic = "force-dynamic";

/** Province list, or the cities of ?provinceCode= for the required region picker. */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const provinceCode = new URL(request.url).searchParams.get("provinceCode");
  if (provinceCode) {
    return NextResponse.json({ cities: citiesOf(provinceCode) });
  }
  return NextResponse.json({ provinces: provinces() });
}
