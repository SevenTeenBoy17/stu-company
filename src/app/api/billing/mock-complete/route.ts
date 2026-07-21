import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { isSuperAdmin } from "@/lib/auth-roles";
import { isWechatMockAllowed } from "@/lib/billing/wechat-pay";
import { fulfillPaymentOrder, getPaymentOrderByOutTradeNo } from "@/lib/db/repo";

const mockCompleteSchema = z.object({
  outTradeNo: z.string().min(8),
});

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isWechatMockAllowed()) {
    return apiError("forbidden", "当前环境未开启课堂演示支付模式。", 403);
  }

  try {
    const body = mockCompleteSchema.parse(await request.json());
    const order = await getPaymentOrderByOutTradeNo(body.outTradeNo);
    if (!order) {
      return apiError("not_found", "支付订单不存在。", 404);
    }

    if (order.channel !== "mock") {
      return apiError("forbidden", "该订单不是课堂演示订单，不能模拟完成。", 403);
    }

    if (order.userId !== auth.user.id && !isSuperAdmin(auth.user)) {
      return apiError("forbidden", "当前账号无权完成该订单。", 403);
    }

    const result = await fulfillPaymentOrder({
      outTradeNo: order.outTradeNo,
      transactionId: `mock-${order.outTradeNo}`,
      paidAt: new Date().toISOString(),
      rawNotify: { mock: true },
    });

    return NextResponse.json({
      order: result.order,
      grant: result.grant,
      alreadyFulfilled: result.alreadyFulfilled,
      message: result.alreadyFulfilled ? "该订单此前已开通。" : "模拟支付完成，订阅权益已开通。",
    });
  } catch (error) {
    return handleRouteError(error, "模拟支付完成失败。");
  }
}
