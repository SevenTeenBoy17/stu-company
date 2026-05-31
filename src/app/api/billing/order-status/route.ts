import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { getPaymentOrderByOutTradeNo } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

/**
 * Poll a payment order's status. After a real WeChat payment, the async
 * /api/billing/notify webhook verifies the signature, decrypts the callback and
 * marks the order paid — the client polls this to know when that verification
 * has landed and the subscription is active. Only the payer can read their order.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const outTradeNo = new URL(request.url).searchParams.get("outTradeNo");
  if (!outTradeNo) return apiError("invalid_input", "缺少订单号。", 400);

  const order = await getPaymentOrderByOutTradeNo(outTradeNo);
  if (!order || order.userId !== auth.user.id) {
    return apiError("not_found", "订单不存在。", 404);
  }

  return NextResponse.json({
    outTradeNo,
    status: order.status,
    paid: order.status === "paid",
  });
}
