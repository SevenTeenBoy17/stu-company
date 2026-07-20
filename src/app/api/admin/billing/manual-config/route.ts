import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { isSuperAdmin } from "@/lib/auth-roles";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import {
  getManualWechatCollectionConfig,
  getManualWechatReadiness,
  saveManualWechatCollectionConfig,
} from "@/lib/billing/manual-wechat";


function optionalHttpUrl(value: string | undefined) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function optionalImageDataUrl(value: string | undefined) {
  if (!value) return true;
  return /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(value);
}

const manualConfigSchema = z.object({
  qrUrl: z
    .string()
    .trim()
    .max(2048, "二维码链接太长，请换一个公开可访问的图片地址。")
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine(optionalHttpUrl, "二维码链接必须是 http 或 https 开头的公开图片地址。"),
  qrImageDataUrl: z
    .string()
    .trim()
    .max(1_200_000, "上传的收款码图片太大，请使用 800KB 以内的 PNG/JPG/WebP 图片。")
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine(optionalImageDataUrl, "上传图片必须是 PNG、JPG 或 WebP 格式。"),
  payeeName: z
    .string()
    .trim()
    .max(80, "收款方名称不能超过 80 个字符。")
    .optional()
    .transform((value) => (value ? value : undefined)),
  instruction: z
    .string()
    .trim()
    .max(500, "付款说明不能超过 500 个字符。")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export async function GET() {
  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  try {
    const config = await getManualWechatCollectionConfig();
    return NextResponse.json({
      config,
      readiness: getManualWechatReadiness(config),
      canManage: isSuperAdmin(auth.user),
    });
  } catch (error) {
    return handleRouteError(error, "读取微信收款配置失败，请稍后再试。");
  }
}

export async function PATCH(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("admin");
  if (auth.error) return auth.error;

  if (!isSuperAdmin(auth.user)) {
    return apiError("forbidden", "只有超级管理员可以修改微信收款配置。", 403);
  }

  try {
    const body = manualConfigSchema.parse(await request.json());
    const config = await saveManualWechatCollectionConfig(body, auth.user.id);
    return NextResponse.json({
      message: "微信收款配置已保存，新的付款页会立即读取这份配置。",
      config,
      readiness: getManualWechatReadiness(config),
    });
  } catch (error) {
    return handleRouteError(error, "保存微信收款配置失败，请稍后再试。");
  }
}
