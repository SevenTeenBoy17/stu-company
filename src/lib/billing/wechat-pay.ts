import { createHmac } from "node:crypto";

export interface WechatPayConfig {
  mchId: string;
  apiKeyV3: string;
  appId: string;
  notifyUrl: string;
}

export interface PrepayRequest {
  outTradeNo: string;
  description: string;
  amountFen: number;
  payerOpenId: string;
}

export interface PrepayResult {
  prepayId: string;
  jsapiParams: {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: "RSA";
    paySign: string;
  };
}

export interface NotifyPayload {
  id: string;
  event_type: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    nonce: string;
    associated_data: string;
  };
}

export interface DecryptedNotify {
  out_trade_no: string;
  transaction_id: string;
  trade_state: "SUCCESS" | "CLOSED" | "PAYERROR" | "NOTPAY";
  amount: { total: number; payer_total: number; currency: string };
  payer: { openid: string };
  success_time: string;
}

function getConfig(): WechatPayConfig | null {
  const mchId = process.env.WECHAT_MCH_ID;
  const apiKeyV3 = process.env.WECHAT_API_KEY_V3;
  const appId = process.env.WECHAT_APP_ID;
  const notifyUrl = process.env.WECHAT_NOTIFY_URL;

  if (!mchId || !apiKeyV3 || !appId || !notifyUrl) return null;
  return { mchId, apiKeyV3, appId, notifyUrl };
}

function generateNonce(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function isWechatPayConfigured(): boolean {
  return getConfig() !== null;
}

export async function createPrepayOrder(request: PrepayRequest): Promise<PrepayResult> {
  const config = getConfig();
  if (!config) throw new Error("微信支付未配置，请联系管理员。");

  const body = {
    appid: config.appId,
    mchid: config.mchId,
    description: request.description,
    out_trade_no: request.outTradeNo,
    notify_url: config.notifyUrl,
    amount: { total: request.amountFen, currency: "CNY" },
    payer: { openid: request.payerOpenId },
  };

  const response = await fetch("https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `WECHATPAY2-SHA256-RSA2048 placeholder`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`微信支付创建订单失败: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { prepay_id: string };

  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = generateNonce();
  const packageStr = `prepay_id=${data.prepay_id}`;

  const signMessage = `${config.appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
  const paySign = createHmac("sha256", config.apiKeyV3).update(signMessage).digest("hex");

  return {
    prepayId: data.prepay_id,
    jsapiParams: {
      appId: config.appId,
      timeStamp,
      nonceStr,
      package: packageStr,
      signType: "RSA",
      paySign,
    },
  };
}

export function verifyWechatSignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
): boolean {
  const config = getConfig();
  if (!config) return false;

  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const expected = createHmac("sha256", config.apiKeyV3).update(message).digest("base64");
  return expected === signature;
}
