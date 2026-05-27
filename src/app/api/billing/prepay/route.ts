import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { createPrepayOrder, isWechatPayConfigured } from "@/lib/billing/wechat-pay";
import { createId } from "@/lib/utils";

const prepaySchema = z.object({
  tier: z.enum(["standard", "premium"]),
  openId: z.string().min(10),
});

const TIER_PRICES_FEN: Record<string, { amount: number; label: string }> = {
  standard: { amount: 1500, label: "Mr.Brown 标准版月度订阅" },
  premium: { amount: 29900, label: "Mr.Brown 旗舰版学期订阅" },
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (auth.user.role === "student") {
    return apiError("forbidden", "学生账号不能直接发起支付，请让家长或教师完成。", 403);
  }

  if (!isWechatPayConfigured()) {
    return apiError("service_unavailable", "微信支付尚未配置，请联系管理员。", 503);
  }

  try {
    const body = prepaySchema.parse(await request.json());
    const price = TIER_PRICES_FEN[body.tier];
    if (!price) return apiError("invalid_input", "未知订阅方案。", 400);

    const result = await createPrepayOrder({
      outTradeNo: createId("order"),
      description: price.label,
      amountFen: price.amount,
      payerOpenId: body.openId,
    });

    return NextResponse.json({
      prepayId: result.prepayId,
      jsapiParams: result.jsapiParams,
    });
  } catch (error) {
    return handleRouteError(error, "创建支付订单失败。");
  }
}
