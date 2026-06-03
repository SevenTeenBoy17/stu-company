import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { verifyBillingIntent } from "@/lib/billing/billing-intent";
import {
  createPrepayOrder,
  isWechatMockAllowed,
  isWechatPayConfigured,
} from "@/lib/billing/wechat-pay";
import {
  canUserPayForTarget,
  createPaymentOrder,
  findUserById,
  updatePaymentOrderProviderFields,
} from "@/lib/db/repo";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createId } from "@/lib/utils";

const prepaySchema = z.object({
  tier: z.enum(["standard", "premium"]),
  channel: z.enum(["native", "jsapi"]).default("native"),
  targetUserId: z.string().min(1).optional(),
  openId: z.string().min(8).optional(),
  billingIntentToken: z.string().min(20).optional(),
});

const PLANS = {
  standard: { amountFen: 1500, label: "Mr.Brown AI 经济沙盘 · 标准版月卡" },
  premium: { amountFen: 3000, label: "Mr.Brown AI 经济沙盘 · 高级版月卡" },
} as const;

function buildOrderExpiry() {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30);
  return expiresAt;
}

function isSharedGuest(user: { id: string; email: string }) {
  return user.id === "guest-student" || user.email.toLowerCase() === "guest@brownzone.ai";
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser();
  if (auth.error) return auth.error;

  // P8: cap payment-order creation to curb order spam (auth + origin already enforced).
  const rl = rateLimit(rateLimitKey("billing-prepay", auth.user.id, request), 10, 60_000);
  if (!rl.ok) return apiError("invalid_input", buildRateLimitMessage(rl), 429);

  try {
    const body = prepaySchema.parse(await request.json());
    if (body.channel === "jsapi" && !body.openId) {
      return apiError("invalid_input", "微信内支付需要 openId。", 400);
    }

    // A signed billing intent names the student to be upgraded. It is issued by
    // the guest-upgrade flow (student self-upgrade) and by /api/billing/parent-link
    // (a shareable link a teen sends to a parent). When present and valid for the
    // requested tier, it authorizes paying for that student — and the target is
    // derived from it, so a parent can pay via the link without being linked.
    const intent = await verifyBillingIntent(body.billingIntentToken);
    const intentTarget =
      intent?.purpose === "guest-upgrade" && intent.tier === body.tier ? intent.userId : undefined;

    const targetUserId = body.targetUserId ?? intentTarget ?? auth.user.id;
    const targetUser = await findUserById(targetUserId);
    if (!targetUser) {
      return apiError("not_found", "订阅目标账号不存在。", 404);
    }

    const intentAuthorizesTarget = intentTarget !== undefined && intentTarget === targetUserId;

    if (auth.user.role === "student") {
      if (isSharedGuest(auth.user)) {
        return apiError("forbidden", "请先升级为个人账号，再开通月卡。", 403);
      }

      // Students may only initiate payment for their own account via a self-issued
      // intent; otherwise payment is completed by a parent/teacher (compliance).
      if (!intentAuthorizesTarget || intentTarget !== auth.user.id) {
        return apiError(
          "forbidden",
          "学生账号不能直接发起付款，请通过游客升级入口或把家长付款链接发给家长完成开通。",
          403,
        );
      }
    } else if (!intentAuthorizesTarget) {
      if ((auth.user.role === "teacher" || auth.user.role === "parent") && !body.targetUserId) {
        return apiError("invalid_input", "请选择要开通的学生账号后再创建订单。", 400);
      }

      const allowedTarget = await canUserPayForTarget(auth.user.id, targetUserId);
      if (!allowedTarget) {
        return apiError("forbidden", "当前账号不能为该用户开通订阅。", 403);
      }
    }

    const outTradeNo = createId("wxorder");
    const expiresAt = buildOrderExpiry();
    const liveConfigured = isWechatPayConfigured();
    const mock =
      process.env.NODE_ENV !== "production" ||
      process.env.WECHAT_PAY_MOCK_MODE === "true" ||
      !liveConfigured;

    if (mock && !isWechatMockAllowed()) {
      return apiError(
        "service_unavailable",
        "微信支付尚未配置，请联系管理员在环境变量中配置商户信息。",
        503,
      );
    }

    let codeUrl: string | undefined;
    let prepayId: string | undefined;
    let jsapiParams: unknown;

    const plan = PLANS[body.tier];

    await createPaymentOrder({
      userId: auth.user.id,
      targetUserId,
      tier: body.tier,
      channel: mock ? "mock" : body.channel,
      amountFen: plan.amountFen,
      description: plan.label,
      outTradeNo,
      expiresAt,
    });

    if (mock) {
      codeUrl = `brown-zone://mock-wechat-pay/${outTradeNo}`;
    } else {
      const result = await createPrepayOrder({
        outTradeNo,
        description: plan.label,
        amountFen: plan.amountFen,
        channel: body.channel,
        payerOpenId: body.openId,
      });
      codeUrl = result.codeUrl;
      prepayId = result.prepayId;
      jsapiParams = result.jsapiParams;
    }

    const updated = await updatePaymentOrderProviderFields(outTradeNo, { codeUrl, prepayId });

    return NextResponse.json({
      orderId: updated.id,
      outTradeNo: updated.outTradeNo,
      codeUrl,
      prepayId,
      jsapiParams,
      expiresAt: updated.expiresAt,
      mock,
    });
  } catch (error) {
    return handleRouteError(error, "创建支付订单失败。");
  }
}
