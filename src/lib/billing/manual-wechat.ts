import { getAppSetting, upsertAppSetting } from "@/lib/db/repo";

export const MANUAL_WECHAT_SETTING_KEY = "billing.manual_wechat";

export interface ManualWechatCollectionConfig {
  qrUrl?: string;
  externalQrUrl?: string;
  qrImageDataUrl?: string;
  qrConfigured: boolean;
  payeeName: string;
  instruction: string;
  source: "database" | "environment" | "default";
  updatedAt?: string;
  updatedBy?: string;
}

export interface ManualWechatCollectionInput {
  qrUrl?: string;
  qrImageDataUrl?: string;
  payeeName?: string;
  instruction?: string;
}

export interface ManualWechatReadinessCheck {
  id: "qr" | "payee" | "instruction" | "proof" | "admin_confirm";
  label: string;
  ok: boolean;
  detail: string;
}

export interface ManualWechatReadiness {
  ready: boolean;
  label: "ready" | "needs_setup";
  checks: ManualWechatReadinessCheck[];
  nextSteps: string[];
}

const DEFAULT_PAYEE_NAME = "Brown Zone";
const DEFAULT_INSTRUCTION =
  "请使用微信扫码付款，并在付款备注中填写订单号。付款后提交转账单号或备注，管理员核验到账后会为账号开通订阅。";

function cleanOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanImageDataUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function fromEnvironment(): ManualWechatCollectionConfig {
  const qrUrl = cleanOptional(process.env.WECHAT_MANUAL_QR_URL || process.env.WECHAT_COLLECTION_QR_URL);
  const payeeName = cleanOptional(process.env.WECHAT_MANUAL_PAYEE_NAME) ?? DEFAULT_PAYEE_NAME;
  const instruction = cleanOptional(process.env.WECHAT_MANUAL_INSTRUCTION) ?? DEFAULT_INSTRUCTION;

  return {
    qrUrl,
    externalQrUrl: qrUrl,
    qrConfigured: Boolean(qrUrl),
    payeeName,
    instruction,
    source: qrUrl ? "environment" : "default",
  };
}

export function getManualWechatReadiness(config: ManualWechatCollectionConfig): ManualWechatReadiness {
  const checks: ManualWechatReadinessCheck[] = [
    {
      id: "qr",
      label: "真实微信收款码",
      ok: config.qrConfigured,
      detail: config.qrConfigured ? "新的付款订单会展示已保存的收款码。" : "需要上传真实收款码图片，或填写公开可访问的收款码图片 URL。",
    },
    {
      id: "payee",
      label: "收款方名称",
      ok: Boolean(cleanOptional(config.payeeName)),
      detail: cleanOptional(config.payeeName) ? `当前收款方：${config.payeeName}` : "请填写收款方名称，方便用户核对。",
    },
    {
      id: "instruction",
      label: "付款说明",
      ok: Boolean(cleanOptional(config.instruction)),
      detail: cleanOptional(config.instruction) ? "付款页会展示清晰的备注与核验说明。" : "请填写用户付款后的备注和提交凭证说明。",
    },
    {
      id: "proof",
      label: "用户凭证提交",
      ok: true,
      detail: "用户可以提交付款备注和付款截图，后台会保留核验记录。",
    },
    {
      id: "admin_confirm",
      label: "后台到账确认",
      ok: true,
      detail: "超级管理员确认到账后，系统会自动开通 30 天订阅并写回订单结果。",
    },
  ];
  const nextSteps = checks.filter((check) => !check.ok).map((check) => check.detail);

  return {
    ready: checks.every((check) => check.ok),
    label: checks.every((check) => check.ok) ? "ready" : "needs_setup",
    checks,
    nextSteps,
  };
}

export async function getManualWechatCollectionConfig(): Promise<ManualWechatCollectionConfig> {
  const envConfig = fromEnvironment();

  try {
    const setting = await getAppSetting<ManualWechatCollectionInput>(MANUAL_WECHAT_SETTING_KEY);
    const value = setting?.value;
    const externalQrUrl = cleanOptional(value?.qrUrl);
    const qrImageDataUrl = cleanImageDataUrl(value?.qrImageDataUrl);
    const qrUrl = qrImageDataUrl ?? externalQrUrl ?? envConfig.qrUrl;
    const payeeName = cleanOptional(value?.payeeName) ?? envConfig.payeeName;
    const instruction = cleanOptional(value?.instruction) ?? envConfig.instruction;

    if (qrUrl || value?.payeeName || value?.instruction || value?.qrImageDataUrl) {
      return {
        qrUrl,
        externalQrUrl,
        qrImageDataUrl,
        qrConfigured: Boolean(qrUrl),
        payeeName,
        instruction,
        source: "database",
        updatedAt: setting?.updatedAt,
        updatedBy: setting?.updatedBy,
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[manual-wechat] falling back to environment config", error);
    }
  }

  return envConfig;
}

export async function saveManualWechatCollectionConfig(
  input: ManualWechatCollectionInput,
  updatedBy: string,
) {
  const value: ManualWechatCollectionInput = {
    qrUrl: cleanOptional(input.qrUrl),
    qrImageDataUrl: cleanImageDataUrl(input.qrImageDataUrl),
    payeeName: cleanOptional(input.payeeName),
    instruction: cleanOptional(input.instruction),
  };

  const setting = await upsertAppSetting(MANUAL_WECHAT_SETTING_KEY, value, updatedBy);
  return getManualWechatCollectionConfig().then((config) => ({
    ...config,
    updatedAt: setting.updatedAt,
    updatedBy: setting.updatedBy,
  }));
}
