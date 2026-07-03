"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ImageIcon, Save, ShieldAlert, Trash2, UploadCloud } from "lucide-react";

import type { ManualWechatCollectionConfig, ManualWechatReadiness } from "@/lib/billing/manual-wechat";

type SaveResponse = {
  message?: string;
  config?: ManualWechatCollectionConfig;
  readiness?: ManualWechatReadiness;
  error?: string;
};

const MAX_QR_IMAGE_BYTES = 800 * 1024;
const ALLOWED_QR_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function ManualWechatConfigCard({
  config,
  initialReadiness,
  canManage,
}: {
  config: ManualWechatCollectionConfig;
  initialReadiness: ManualWechatReadiness;
  canManage: boolean;
}) {
  const [current, setCurrent] = useState(config);
  const [readiness, setReadiness] = useState(initialReadiness);
  const [externalQrUrl, setExternalQrUrl] = useState(config.externalQrUrl ?? "");
  const [qrImageDataUrl, setQrImageDataUrl] = useState(config.qrImageDataUrl ?? "");
  const [uploadedImageCleared, setUploadedImageCleared] = useState(false);
  const [payeeName, setPayeeName] = useState(config.payeeName);
  const [instruction, setInstruction] = useState(config.instruction);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const previewSrc = qrImageDataUrl || externalQrUrl || (!uploadedImageCleared ? current.qrUrl : undefined);

  function handleFileChange(file?: File) {
    if (!file) return;
    if (!ALLOWED_QR_IMAGE_TYPES.has(file.type)) {
      setMessage("请上传 PNG、JPG 或 WebP 格式的微信收款码图片。");
      return;
    }
    if (file.size > MAX_QR_IMAGE_BYTES) {
      setMessage("图片太大了，请压缩到 800KB 以内后再上传。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setMessage("图片读取失败，请换一张图片再试。");
        return;
      }
      setQrImageDataUrl(reader.result);
      setUploadedImageCleared(false);
      setMessage("二维码图片已读取，请点击“保存收款配置”后生效。");
    };
    reader.onerror = () => setMessage("图片读取失败，请换一张图片再试。");
    reader.readAsDataURL(file);
  }

  function clearUploadedImage() {
    setQrImageDataUrl("");
    setUploadedImageCleared(true);
    setMessage("已清除上传图片。保存后系统会改用外链 URL，或回到未配置状态。");
  }

  function saveConfig() {
    if (!canManage) return;
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/admin/billing/manual-config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qrUrl: externalQrUrl,
          qrImageDataUrl,
          payeeName,
          instruction,
        }),
      });
      const data = (await response.json()) as SaveResponse;
      if (!response.ok || !data.config) {
        setMessage(data.message ?? "保存失败，请稍后再试。");
        return;
      }
      setCurrent(data.config);
      setExternalQrUrl(data.config.externalQrUrl ?? "");
      setQrImageDataUrl(data.config.qrImageDataUrl ?? "");
      setUploadedImageCleared(false);
      setPayeeName(data.config.payeeName);
      setInstruction(data.config.instruction);
      if (data.readiness) setReadiness(data.readiness);
      setMessage(data.message ?? "微信收款配置已保存。");
    });
  }

  return (
    <section className="panel rounded-[2rem] p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div>
          <p className="bz-eyebrow">WECHAT QR CONFIG</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-slate-950">微信收款码配置状态</h2>
              <p className="mt-2 max-w-3xl text-base font-semibold leading-8 text-slate-600">
                当前采用“微信收款码 + 用户提交付款凭证 + 超级管理员确认到账”的订阅开通路线。
                管理员可以直接上传收款码图片，也可以填写公开图片 URL；保存后，新的付款订单会立即读取这份配置。
              </p>
            </div>
            <span
              className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-black ${
                readiness.ready ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
              }`}
            >
              {readiness.ready ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
              {readiness.ready ? "支付上线就绪" : "等待配置二维码"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">配置来源</p>
              <p className="mt-2 text-lg font-black text-slate-950">
                {current.source === "database" ? "后台配置" : current.source === "environment" ? "环境变量" : "默认说明"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">收款方</p>
              <p className="mt-2 break-words text-lg font-black text-slate-950">{current.payeeName}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">核验方式</p>
              <p className="mt-2 text-lg font-black text-slate-950">后台确认到账</p>
            </div>
          </div>

          <div
            className={`mt-5 rounded-[1.5rem] border p-4 ${
              readiness.ready ? "border-emerald-200 bg-emerald-50/70" : "border-orange-200 bg-orange-50/70"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">Launch Readiness</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  {readiness.ready ? "微信收款可以上线使用" : "微信收款还差最后配置"}
                </h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700">
                {readiness.checks.filter((check) => check.ok).length}/{readiness.checks.length} 已通过
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {readiness.checks.map((check) => (
                <div key={check.id} className="rounded-2xl bg-white p-3">
                  <div className="flex items-center gap-2">
                    {check.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-orange-600" />
                    )}
                    <p className="text-sm font-black text-slate-950">{check.label}</p>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{check.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {canManage ? (
            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <label className="block">
                  <span className="text-sm font-black text-slate-700">上传微信收款码图片</span>
                  <span className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 text-sm font-black text-orange-700 transition hover:-translate-y-0.5 hover:bg-orange-100">
                    <UploadCloud className="h-4 w-4" />
                    选择 PNG / JPG / WebP 图片
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => handleFileChange(event.target.files?.[0])}
                    />
                  </span>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">
                    推荐上传 600x600 左右的清晰截图，大小不超过 800KB。上传图片优先于外链 URL。
                  </span>
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-700">收款码图片 URL（可选）</span>
                  <input
                    value={externalQrUrl}
                    onChange={(event) => setExternalQrUrl(event.target.value)}
                    placeholder="https://.../wechat-qr.png"
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <label className="block">
                  <span className="text-sm font-black text-slate-700">收款方名称</span>
                  <input
                    value={payeeName}
                    onChange={(event) => setPayeeName(event.target.value)}
                    placeholder="Brown Zone"
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-700">付款说明</span>
                  <textarea
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-7 text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveConfig}
                  disabled={isPending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-black text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {isPending ? "正在保存..." : "保存收款配置"}
                </button>
                {qrImageDataUrl ? (
                  <button
                    type="button"
                    onClick={clearUploadedImage}
                    disabled={isPending}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    清除上传图片
                  </button>
                ) : null}
                {message ? <p className="text-sm font-bold text-orange-700">{message}</p> : null}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-7 text-slate-600">
              当前账号只有查看权限。请使用超级管理员账号进入后台后修改收款配置。
            </div>
          )}

          {!readiness.ready ? (
            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold leading-7 text-orange-800">
              <p className="font-black">下一步：</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {readiness.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="mt-2">
                如果后台配置为空，系统仍会尝试读取 Vercel 环境变量
                <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs">WECHAT_MANUAL_QR_URL</code>。
              </p>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">上线前验证路径</p>
            <ol className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-slate-600 md:grid-cols-2">
              <li className="rounded-xl bg-white p-3">1. 上传真实微信收款码，保存后确认这里显示“支付上线就绪”。</li>
              <li className="rounded-xl bg-white p-3">2. 打开订阅页创建 15 元/月订单，付款区应展示同一张收款码。</li>
              <li className="rounded-xl bg-white p-3">3. 用户付款后提交备注或截图，后台“人工收款订单”应显示待核验。</li>
              <li className="rounded-xl bg-white p-3">4. 超级管理员确认到账后，用户付款页应出现回执号和有效期。</li>
            </ol>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-center">
          {previewSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- administrator-provided WeChat collection QR image */}
              <img
                src={previewSrc}
                alt="当前微信收款码"
                className="mx-auto aspect-square w-full max-w-[240px] rounded-2xl border border-slate-200 bg-white object-contain p-2"
              />
              <p className="mt-3 break-all text-xs font-semibold leading-5 text-slate-500">
                {qrImageDataUrl ? "已选择上传图片，保存后生效" : previewSrc}
              </p>
            </>
          ) : (
            <div className="flex aspect-square w-full max-w-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-bold leading-6 text-slate-400">
              <span>
                <ImageIcon className="mx-auto mb-3 h-8 w-8" />
                等待配置真实微信收款码
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
