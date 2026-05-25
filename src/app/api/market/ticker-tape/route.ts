import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api-response";
import { getTickerTapePayload } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getTickerTapePayload();

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, "股票轮播条暂时不可用。");
  }
}
