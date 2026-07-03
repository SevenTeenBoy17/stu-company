import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { attachManualPaymentProof, getPaymentOrderByOutTradeNo } from "@/lib/db/repo";

function optionalImageDataUrl(value: string | undefined) {
  if (!value) return true;
  return /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(value);
}

const manualProofSchema = z.object({
  outTradeNo: z.string().min(8),
  note: z.string().trim().min(2).max(180),
  proofImageDataUrl: z
    .string()
    .trim()
    .max(1_200_000, "付款截图太大，请上传 800KB 以内的 PNG/JPG/WebP 图片。")
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine(optionalImageDataUrl, "付款截图必须是 PNG、JPG 或 WebP 格式。"),
});

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  // 计费路径限流（对齐 prepay/parent-link）：付款凭证可携带约 1.2MB base64，且允许覆盖
  // pending 订单——补限流防止重复轰炸/存储放大（AGENTS.md 要求 payment-intent 路由挂限流）。
  const rl = rateLimit(rateLimitKey("manual-proof", auth.user.id, request), 8, 60_000);
  if (!rl.ok) {
    return apiError("service_unavailable", buildRateLimitMessage(rl), 429);
  }

  try {
    const body = manualProofSchema.parse(await request.json());
    const order = await getPaymentOrderByOutTradeNo(body.outTradeNo);
    if (!order || order.userId !== auth.user.id) {
      return apiError("not_found", "订单不存在。", 404);
    }
    if (order.channel !== "manual") {
      return apiError("invalid_input", "该订单不是人工核验订单。", 400);
    }
    if (order.status !== "pending") {
      return apiError("conflict", "该订单已处理，不能重复提交凭证。", 409);
    }

    const updated = await attachManualPaymentProof(body.outTradeNo, {
      note: body.note,
      proofImageDataUrl: body.proofImageDataUrl,
      submittedBy: auth.user.id,
    });

    return NextResponse.json({
      order: updated,
      message: body.proofImageDataUrl
        ? "付款备注和截图已提交。管理员核验到账后会自动开通订阅，本页面会持续刷新订单结果。"
        : "付款备注已提交。管理员核验到账后会自动开通订阅，本页面会持续刷新订单结果。",
    });
  } catch (error) {
    return handleRouteError(error, "提交付款凭证失败。");
  }
}
