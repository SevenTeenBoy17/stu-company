"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ImageIcon, RefreshCw, ShieldCheck } from "lucide-react";

import type { PaymentOrder, Role, SubscriptionTier } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type AdminUserSummary = {
  id: string;
  email: string;
  role: Role;
  name: string;
  subscriptionTier?: SubscriptionTier;
  subscriptionExpiresAt?: string;
};

type ManualOrderItem = {
  order: PaymentOrder;
  payer: AdminUserSummary;
  target: AdminUserSummary;
};

type ManualProof = {
  note?: unknown;
  proofImageDataUrl?: unknown;
  submittedAt?: unknown;
};

function getManualProof(rawNotify: unknown): ManualProof | null {
  if (!rawNotify || typeof rawNotify !== "object") return null;
  const manualProof = (rawNotify as { manualProof?: ManualProof }).manualProof;
  return manualProof && typeof manualProof === "object" ? manualProof : null;
}

function proofNote(rawNotify: unknown) {
  const note = getManualProof(rawNotify)?.note;
  return typeof note === "string" && note.trim() ? note : "尚未提交付款备注";
}

function proofImage(rawNotify: unknown) {
  const image = getManualProof(rawNotify)?.proofImageDataUrl;
  return typeof image === "string" && image.startsWith("data:image/") ? image : undefined;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ManualPaymentOrders({
  orders,
  canManage,
}: {
  orders: ManualOrderItem[];
  canManage: boolean;
}) {
  const [items, setItems] = useState(orders);
  const [message, setMessage] = useState<string | null>(null);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmOrder(outTradeNo: string) {
    if (!canManage) return;
    startTransition(async () => {
      setBusyOrder(outTradeNo);
      setMessage(null);
      const response = await fetch("/api/admin/billing/manual-confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outTradeNo, note: "后台人工核验到账" }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setMessage(data.message ?? data.error ?? "确认订单失败，请稍后重试。");
        setBusyOrder(null);
        return;
      }
      setItems((current) => current.filter((item) => item.order.outTradeNo !== outTradeNo));
      setMessage(data.message ?? "人工收款已确认，订阅权益已开通。");
      setBusyOrder(null);
    });
  }

  return (
    <section className="panel rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="bz-eyebrow">MANUAL WECHAT</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">微信收款人工核验</h2>
          <p className="mt-2 max-w-3xl text-base font-semibold leading-8 text-slate-600">
            暂缓微信商户回调时，用户可先扫码转账并提交付款备注或截图；超级管理员核验到账后，一键开通 30 天订阅。
          </p>
        </div>
        <div className="inline-flex min-h-11 items-center gap-2 rounded-full bg-orange-50 px-4 text-sm font-black text-orange-700">
          <ShieldCheck className="h-4 w-4" />
          待核验 {items.length}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">
          暂无待核验的人工收款订单。
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {items.map((item) => {
            const image = proofImage(item.order.rawNotify);
            return (
              <article key={item.order.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-black text-slate-950">{item.order.outTradeNo}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">创建于 {formatDate(item.order.createdAt)}</p>
                  </div>
                  <strong className="rounded-full bg-orange-50 px-3 py-1 text-sm font-black text-orange-700">
                    {formatCurrency(item.order.amountFen / 100)}
                  </strong>
                </div>
                <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold text-slate-400">付款账号</p>
                    <p className="mt-1 break-all font-black text-slate-900">{item.payer.name}</p>
                    <p className="break-all text-xs font-semibold text-slate-500">{item.payer.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400">开通账号</p>
                    <p className="mt-1 break-all font-black text-slate-900">{item.target.name}</p>
                    <p className="break-all text-xs font-semibold text-slate-500">{item.target.email}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-bold text-amber-700">用户提交的付款备注</p>
                  <p className="mt-1 break-words text-sm font-semibold leading-6 text-slate-700">
                    {proofNote(item.order.rawNotify)}
                  </p>
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">付款截图</p>
                  {image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- user-submitted payment proof preview */}
                      <img
                        src={image}
                        alt="用户提交的付款截图"
                        className="mt-2 max-h-72 w-full rounded-2xl border border-slate-200 bg-white object-contain p-2"
                      />
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        请人工核对截图、微信到账记录和订单号后再确认开通。
                      </p>
                    </>
                  ) : (
                    <div className="mt-2 flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm font-bold text-slate-400">
                      <ImageIcon className="mr-2 h-4 w-4" />
                      用户未上传付款截图
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => confirmOrder(item.order.outTradeNo)}
                  disabled={!canManage || isPending || busyOrder === item.order.outTradeNo}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-black text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {busyOrder === item.order.outTradeNo ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {busyOrder === item.order.outTradeNo ? "正在确认..." : "确认到账并开通"}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {message ? (
        <p className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm font-bold text-orange-700">
          {message}
        </p>
      ) : null}
    </section>
  );
}
