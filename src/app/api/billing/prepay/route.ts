import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { verifyBillingIntent } from "@/lib/billing/billing-intent";
import { getManualWechatCollectionConfig } from "@/lib/billing/manual-wechat";
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
  channel: z.enum(["native", "jsapi", "manual"]).default("native"),
  targetUserId: z.string().min(1).optional(),
  openId: z.string().min(8).optional(),
  billingIntentToken: z.string().min(20).optional(),
});

const PLANS = {
  standard: { amountFen: 1500, label: "Mr.Brown AI 经济沙盘 · 标准版月卡" },
  premium: { amountFen: 3000, label: "Mr.Brown AI 经济沙盘 · 高级版月卡" },
} as const;

function buildOrderExpiry(minutes = 30) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
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

  const rl = rateLimit(rateLimitKey("billing-prepay", auth.user.id, request), 10, 60_000);
  if (!rl.ok) return apiError("invalid_input", buildRateLimitMessage(rl), 429);

  try {
    const body = prepaySchema.parse(await request.json());
    if (body.channel === "jsapi" && !body.openId) {
      return apiError("invalid_input", "微信内支付需要 openId。", 400);
    }

    const intent = await verifyBillingIntent(body.billingIntentToken);
    const guestUpgradeTarget =
      intent?.purpose === "guest-upgrade-prepay" && intent.tier === body.tier ? intent.userId : undefined;
    const parentLinkTarget =
      intent?.purpose === "parent-link-prepay" && intent.tier === body.tier ? intent.userId : undefined;
    const intentTarget = guestUpgradeTarget ?? parentLinkTarget;

    const targetUserId = body.targetUserId ?? intentTarget ?? auth.user.id;
    const targetUser = await findUserById(targetUserId);
    if (!targetUser) {
      return apiError("not_found", "订阅目标账号不存在。", 404);
    }

    const guestUpgradeAuthorizesTarget = guestUpgradeTarget !== undefined && guestUpgradeTarget === targetUserId;
    const parentLinkAuthorizesTarget = parentLinkTarget !== undefined && parentLinkTarget === targetUserId;
    const intentAuthorizesTarget = guestUpgradeAuthorizesTarget || parentLinkAuthorizesTarget;

    if (auth.user.role === "student") {
      if (isSharedGuest(auth.user)) {
        return apiError("forbidden", "请先升级为个人账号，再生成家长确认链接。", 403);
      }

      return apiError("forbidden", "学生账号不能直接发起付款，请让家长或老师查看开通说明。", 403);
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
    const expiresAt = buildOrderExpiry(body.channel === "manual" ? 24 * 60 : 30);
    const liveConfigured = isWechatPayConfigured();
    const mock =
      body.channel !== "manual" &&
      (process.env.NODE_ENV !== "production" ||
        process.env.WECHAT_PAY_MOCK_MODE === "true" ||
        !liveConfigured);

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
    const manualConfig = body.channel === "manual" ? await getManualWechatCollectionConfig() : undefined;

    await createPaymentOrder({
      userId: auth.user.id,
      targetUserId,
      tier: body.tier,
      channel: body.channel === "manual" ? "manual" : mock ? "mock" : body.channel,
      amountFen: plan.amountFen,
      description: plan.label,
      outTradeNo,
      expiresAt,
    });

    if (body.channel === "manual") {
      codeUrl = manualConfig?.qrUrl;
    } else if (mock) {
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
      amountFen: updated.amountFen,
      description: updated.description,
      paymentMode:
        body.channel === "manual"
          ? "wechat_manual"
          : mock
            ? "mock"
            : body.channel === "jsapi"
              ? "wechat_jsapi"
              : "wechat_native",
      manual: body.channel === "manual",
      manualPayment: manualConfig,
      message:
        body.channel === "manual"
          ? "请使用微信完成付款，并在付款备注中填写订单号。提交付款凭证后，超级管理员核验到账即可开通订阅。"
          : undefined,
      mock,
    });
  } catch (error) {
    return handleRouteError(error, "创建支付订单失败。");
  }
}
