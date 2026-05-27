import { NextResponse } from "next/server";

import { verifyWechatSignature } from "@/lib/billing/wechat-pay";

export async function POST(request: Request) {
  const timestamp = request.headers.get("Wechatpay-Timestamp") ?? "";
  const nonce = request.headers.get("Wechatpay-Nonce") ?? "";
  const signature = request.headers.get("Wechatpay-Signature") ?? "";
  const body = await request.text();

  if (!verifyWechatSignature(timestamp, nonce, body, signature)) {
    return NextResponse.json(
      { code: "FAIL", message: "签名验证失败" },
      { status: 401 },
    );
  }

  // Payment fulfillment not yet implemented — return FAIL so WeChat retries
  // until monetization_wechat_engineer completes the decrypt + fulfill logic.
  return NextResponse.json(
    { code: "FAIL", message: "支付处理尚未上线，请联系客服。" },
    { status: 500 },
  );
}
