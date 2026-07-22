"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Mail, ScrollText, Sparkles, Users } from "lucide-react";

type Member = {
  id: string;
  studentUserId: string;
  studentName: string;
  studentEmail: string;
};

type EligibleTarget = { id: string; name: string; email: string };

type BillingStatus = {
  viewer?: { id: string; name: string };
  tier?: string;
  status?: string;
  features?: { maxStudents?: number };
  eligibleTargets?: EligibleTarget[];
};

type Order = { outTradeNo: string; codeUrl?: string; mock?: boolean };

/**
 * Parent-facing family management (Option B): buy Premium for the family, then
 * add/remove up to maxStudents children who inherit Premium.
 */
export function FamilyManager() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/billing/status", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as (BillingStatus & { message?: string }) | null;
    if (!response.ok) {
      throw new Error(data?.message ?? "家庭订阅状态加载失败，请稍后重试。");
    }
    setStatus(data);
  }, []);

  const loadMembers = useCallback(async () => {
    const response = await fetch("/api/family/members", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as { members?: Member[]; message?: string } | null;
    if (!response.ok) {
      throw new Error(data?.message ?? "家庭成员加载失败，请稍后重试。");
    }
    setMembers(data?.members ?? []);
  }, []);

  const refreshFamilyData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await Promise.all([loadStatus(), loadMembers()]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "家庭信息加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [loadMembers, loadStatus]);

  useEffect(() => {
    void refreshFamilyData();
  }, [refreshFamilyData]);

  const isPremium = status?.status === "active" && status?.tier === "premium";
  const maxSeats = status?.features?.maxStudents ?? 0;
  const seatsLeft = Math.max(0, maxSeats - members.length);
  // Bound children not yet in the family — the only ones a parent can add.
  const memberIds = new Set(members.map((m) => m.studentUserId));
  const addable = (status?.eligibleTargets ?? []).filter((t) => !memberIds.has(t.id));

  function addMember() {
    if (!selectedId) return;
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/family/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentUserId: selectedId }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setMessage(data.message ?? "添加失败，请稍后重试。");
        return;
      }
      setSelectedId("");
      setMessage(data.message ?? "已加入家庭组。");
      await loadMembers().catch((error) => {
        setMessage(error instanceof Error ? error.message : "成员已提交，但列表刷新失败，请手动重试。");
      });
    });
  }

  function removeMember(studentUserId: string) {
    startTransition(async () => {
      const response = await fetch("/api/family/members", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentUserId }),
      });
      if (response.ok) {
        await loadMembers().catch((error) => {
          setMessage(error instanceof Error ? error.message : "成员已移出，但列表刷新失败，请手动重试。");
        });
      } else {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(data?.message ?? "移出成员失败，请稍后重试。");
      }
    });
  }

  function buyPremium() {
    startTransition(async () => {
      setMessage(null);
      if (!status?.viewer?.id) return;
      const response = await fetch("/api/billing/prepay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier: "premium", channel: "native", targetUserId: status.viewer.id }),
      });
      const data = (await response.json()) as Order & { message?: string; error?: string };
      if (!response.ok) {
        setMessage(data.message ?? "开通失败，请稍后重试。");
        return;
      }
      setOrder({ outTradeNo: data.outTradeNo, codeUrl: data.codeUrl, mock: data.mock });
    });
  }

  function completeMock() {
    startTransition(async () => {
      if (!order) return;
      const response = await fetch("/api/billing/mock-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outTradeNo: order.outTradeNo }),
      });
      if (response.ok) {
        setOrder(null);
        setMessage("高级版已开通，现在可以添加孩子了。");
        await refreshFamilyData();
      }
    });
  }

  return (
    <section data-motion-reveal className="panel rounded-3xl p-6">
      <p className="bz-eyebrow">家庭高级版</p>
      <h2 className="mt-4 text-2xl font-semibold text-fg-default">家庭组管理</h2>

      {loading ? (
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="h-5 w-2/3 animate-pulse rounded-full bg-bg-muted" />
          <div className="h-11 w-44 animate-pulse rounded-full bg-bg-muted" />
        </div>
      ) : loadError ? (
        <div className="mt-4 rounded-2xl border border-[var(--error-100)] bg-[var(--error-50)] p-4">
          <p className="text-sm font-bold text-[var(--error-600)]">{loadError}</p>
          <button
            type="button"
            data-motion-button
            onClick={() => void refreshFamilyData()}
            className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-bold text-fg-default shadow-sm transition hover:-translate-y-0.5"
          >
            重新加载家庭信息
          </button>
        </div>
      ) : !isPremium ? (
        <div className="mt-4">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { Icon: Users, label: "多孩继承" },
              { Icon: Sparkles, label: "AI 评定" },
              { Icon: ScrollText, label: "人格报告" },
              { Icon: Mail, label: "每周成长邮件" },
            ].map(({ Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-2xl bg-bg-muted px-3 py-2.5 text-sm font-semibold text-fg-default"
              >
                <Icon className="h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-motion-button
            onClick={buyPremium}
            disabled={pending}
            className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "处理中…" : "开通家庭高级版 · ¥30/月"}
          </button>
          {order ? (
            <div data-motion-card className="mt-3 rounded-2xl bg-bg-muted p-4">
              <p className="text-xs text-fg-muted">订单号：{order.outTradeNo}</p>
              {order.codeUrl ? (
                <textarea
                  readOnly
                  value={order.codeUrl}
                  className="mt-2 min-h-16 w-full rounded-xl border border-border bg-white p-2 text-xs"
                />
              ) : null}
              {order.mock ? (
                <button
                  type="button"
                  data-motion-button
                  onClick={completeMock}
                  disabled={pending}
                  className="mt-2 rounded-full bg-bg-inverse px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  模拟支付成功并开通
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-fg-muted">
            家庭名额：已用 {members.length} / {maxSeats}，剩余 {seatsLeft} 个。
          </p>
          <div className="mt-4 space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-bg-muted px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-fg-default">{member.studentName}</p>
                  <p className="break-all text-xs text-fg-muted">{member.studentEmail}</p>
                </div>
                <button
                  type="button"
                  data-motion-button
                  onClick={() => removeMember(member.studentUserId)}
                  disabled={pending}
                  className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-fg-muted transition-colors hover:text-fg-default disabled:opacity-60"
                >
                  移出
                </button>
              </div>
            ))}
            {members.length === 0 ? (
              <p className="text-sm text-fg-muted">还没有添加孩子。从下方选择已与你绑定的孩子即可加入家庭组。</p>
            ) : null}
          </div>
          {seatsLeft > 0 ? (
            addable.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  aria-label="选择要加入家庭组的孩子"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
                >
                  <option value="">选择要加入家庭的孩子…</option>
                  {addable.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name} · {target.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  data-motion-button
                  onClick={addMember}
                  disabled={pending || !selectedId}
                  className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:opacity-90 disabled:opacity-60"
                >
                  添加孩子
                </button>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-bg-muted px-4 py-3 text-sm leading-6 text-fg-muted">
                你还没有可添加的已绑定孩子。请让孩子在注册时使用你的家长邀请码，或联系老师/管理员完成亲子绑定后，再回来添加。
              </p>
            )
          ) : null}
        </div>
      )}

      {message ? (
        <p role="status" aria-live="polite" className="mt-3 text-sm font-medium text-fg-default">
          {message}
        </p>
      ) : null}
    </section>
  );
}
