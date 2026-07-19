import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { isSuperAdmin } from "@/lib/auth-roles";
import { fulfillPaymentOrder, getPaymentOrderByOutTradeNo } from "@/lib/db/repo";

const manualConfirmSchema = z.object({
  outTradeNo: z.string().min(8),
  note: z.string().trim().max(180).optional(),
});


export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("admin");
  if (auth.error) return auth.error;
  if (!isSuperAdmin(auth.user)) {
    return apiError("forbidden", "只有超级管理员可以确认人工收款订单。", 403);
  }

  try {
    const body = manualConfirmSchema.parse(await request.json());
    const order = await getPaymentOrderByOutTradeNo(body.outTradeNo);
    if (!order) {
      return apiError("not_found", "订单不存在。", 404);
    }
    if (order.channel !== "manual") {
      return apiError("invalid_input", "该订单不是人工核验订单。", 400);
    }

    const result = await fulfillPaymentOrder({
      outTradeNo: order.outTradeNo,
      transactionId: `manual-${order.outTradeNo}`,
      paidAt: new Date().toISOString(),
      rawNotify: {
        ...(order.rawNotify && typeof order.rawNotify === "object" ? order.rawNotify : {}),
        manualConfirmed: true,
        confirmedBy: auth.user.id,
        confirmedAt: new Date().toISOString(),
        confirmNote: body.note,
      },
      paidAmountFen: order.amountFen,
    });

    return NextResponse.json({
      order: result.order,
      grant: result.grant,
      alreadyFulfilled: result.alreadyFulfilled,
      message: result.alreadyFulfilled ? "该订单此前已开通。" : "人工收款已确认，订阅权益已开通。",
    });
  } catch (error) {
    return handleRouteError(error, "人工确认订单失败。");
  }
}
