import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { findUserById, getPaymentOrderByOutTradeNo } from "@/lib/db/repo";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function hasManualProof(rawNotify: unknown) {
  if (!rawNotify || typeof rawNotify !== "object") return false;
  const proof = (rawNotify as { manualProof?: unknown }).manualProof;
  return Boolean(proof && typeof proof === "object");
}

function formatDateTime(value?: string) {
  if (!value) return undefined;
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function channelLabel(channel: string) {
  if (channel === "manual") return "微信收款码人工核验";
  if (channel === "mock") return "课堂演示支付";
  if (channel === "jsapi") return "微信 JSAPI 支付";
  return "微信扫码支付";
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const outTradeNo = new URL(request.url).searchParams.get("outTradeNo");
  if (!outTradeNo) return apiError("invalid_input", "缺少订单号。", 400);

  const order = await getPaymentOrderByOutTradeNo(outTradeNo);
  if (!order || order.userId !== auth.user.id) {
    return apiError("not_found", "订单不存在。", 404);
  }
  const targetUser = await findUserById(order.targetUserId);
  const subscriptionExpiresAt = targetUser?.subscriptionExpiresAt;
  const paid = order.status === "paid";

  return NextResponse.json({
    outTradeNo,
    orderId: order.id,
    channel: order.channel,
    status: order.status,
    paid,
    manualProofSubmitted: order.channel === "manual" ? hasManualProof(order.rawNotify) : false,
    tier: order.tier,
    amountFen: order.amountFen,
    description: order.description,
    paidAt: order.paidAt,
    expiresAt: order.expiresAt,
    targetUser: targetUser
      ? {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          subscriptionTier: targetUser.subscriptionTier,
          subscriptionExpiresAt,
        }
      : null,
    receipt: paid
      ? {
          receiptNo: `BZ-${order.outTradeNo}`,
          orderId: order.id,
          outTradeNo: order.outTradeNo,
          amountLabel: formatCurrency(order.amountFen / 100),
          channelLabel: channelLabel(order.channel),
          paidAt: order.paidAt,
          paidAtLabel: formatDateTime(order.paidAt),
          subscriptionExpiresAt,
          subscriptionExpiresAtLabel: formatDateTime(subscriptionExpiresAt),
          targetName: targetUser?.name ?? "当前账号",
          targetEmail: targetUser?.email ?? "",
          description: order.description,
        }
      : null,
  });
}
