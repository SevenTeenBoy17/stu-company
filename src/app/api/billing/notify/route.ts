import { NextResponse } from "next/server";

import {
  decryptWechatResource,
  type NotifyPayload,
  verifyWechatSignature,
} from "@/lib/billing/wechat-pay";
import { fulfillPaymentOrder, markPaymentOrderStatus } from "@/lib/db/repo";

function wechatFail(message: string, status = 500) {
  return NextResponse.json({ code: "FAIL", message }, { status });
}

export async function POST(request: Request) {
  const timestamp = request.headers.get("Wechatpay-Timestamp") ?? "";
  const nonce = request.headers.get("Wechatpay-Nonce") ?? "";
  const signature = request.headers.get("Wechatpay-Signature") ?? "";
  const body = await request.text();

  if (!verifyWechatSignature(timestamp, nonce, body, signature)) {
    return wechatFail("签名验证失败", 401);
  }

  try {
    const payload = JSON.parse(body) as NotifyPayload;
    const decrypted = decryptWechatResource(payload.resource);

    if (decrypted.trade_state === "SUCCESS") {
      await fulfillPaymentOrder({
        outTradeNo: decrypted.out_trade_no,
        transactionId: decrypted.transaction_id,
        paidAt: decrypted.success_time,
        rawNotify: decrypted,
        paidAmountFen: decrypted.amount?.total,
      });
      return NextResponse.json({ code: "SUCCESS", message: "成功" });
    }

    if (decrypted.trade_state === "CLOSED") {
      await markPaymentOrderStatus(decrypted.out_trade_no, "closed");
    } else if (decrypted.trade_state === "PAYERROR") {
      await markPaymentOrderStatus(decrypted.out_trade_no, "failed");
    }

    return NextResponse.json({ code: "SUCCESS", message: "已记录非成功支付状态" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "支付回调处理失败";
    return wechatFail(message);
  }
}
