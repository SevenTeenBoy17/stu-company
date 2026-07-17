"use client";

import { useState, useTransition } from "react";

import { MoneyText } from "@/components/shared/money-text";
import { formatCurrency } from "@/lib/utils";

type TeacherOverview = {
  classroom: { name: string; region: string; challengeTheme: string; schoolRank: number };
  assignments: Array<{ id: string; title: string; brief: string; difficulty: string; dueLabel: string }>;
  invites: Array<{ id: string; code: string; label: string; usesRemaining: number }>;
  leaderboard: Array<{ userId: string; name: string; netWorth: number; disciplineScore: number; rank: number }>;
  students: Array<{
    id: string;
    name: string;
    title: string;
    latestSnapshot?: { netWorth: number; riskScore: number };
    signals: Array<{ label: string; tone: string }>;
  }>;
};

export function TeacherConsole({ initialData }: { initialData: TeacherOverview }) {
  const [data, setData] = useState(initialData);
  const [form, setForm] = useState({
    title: "新增班级挑战任务",
    brief: "让学生在维持 20% 现金缓冲的前提下，完成一次组合再平衡并写出复盘。",
    difficulty: "策略",
    dueLabel: "下周一 18:00",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function refreshOverview() {
    const response = await fetch("/api/teacher/classroom", { cache: "no-store" });
    const payload = (await response.json()) as { overview?: TeacherOverview; error?: string; message?: string };
    if (!response.ok || !payload.overview) {
      throw new Error(payload.message ?? "班级数据更新失败。");
    }
    setData(payload.overview);
  }

  async function createAssignment() {
    const response = await fetch("/api/teacher/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      throw new Error(payload.message ?? "任务创建失败。");
    }
    setMessage(payload.message ?? "任务已创建。");
    await refreshOverview();
  }

  return (
    <div data-motion-reveal className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          ["班级名称", data.classroom.name],
          ["所在地区", data.classroom.region],
          ["当前主题", data.classroom.challengeTheme],
          ["校内排名", `第 ${data.classroom.schoolRank} 名`],
        ].map(([label, value]) => (
          <div key={label} data-motion-card className="panel rounded-3xl p-5">
            <p className="text-sm text-fg-muted">{label}</p>
            <p className="mt-3 break-words text-2xl font-semibold text-fg-default">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section data-motion-reveal className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">班级排行</p>
          <div className="mt-5 space-y-3">
            {data.leaderboard.map((entry) => (
              <div key={entry.userId} data-motion-card className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bg-muted px-4 py-4">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-fg-default">
                    #{entry.rank} {entry.name}
                  </p>
                  <p className="mt-1 text-sm text-fg-muted">纪律分 {entry.disciplineScore}</p>
                </div>
                <p className="shrink-0 text-lg font-semibold">
                  <MoneyText>{formatCurrency(entry.netWorth)}</MoneyText>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section data-motion-reveal className="panel rounded-3xl p-6">
          {/* itest9 a11y P1(3.3.2/1.3.1/4.1.2)：分区标题用 h2、4 个输入补可见 label——此前读屏只报控件 value、
              无字段名，教师无法分辨/填写发布任务表单。 */}
          <h2 className="bz-eyebrow">发起任务</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-caption font-semibold text-fg-muted">任务标题</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="bz-field"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-caption font-semibold text-fg-muted">任务简介</span>
              <textarea
                value={form.brief}
                onChange={(event) => setForm((current) => ({ ...current, brief: event.target.value }))}
                rows={4}
                className="bz-field"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-caption font-semibold text-fg-muted">难度</span>
                <input
                  value={form.difficulty}
                  onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value }))}
                  className="bz-field"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-caption font-semibold text-fg-muted">截止时间</span>
                <input
                  value={form.dueLabel}
                  onChange={(event) => setForm((current) => ({ ...current, dueLabel: event.target.value }))}
                  className="bz-field"
                />
              </label>
            </div>
            <button
              data-motion-button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  createAssignment().catch((error) => {
                    setMessage(error instanceof Error ? error.message : "任务创建失败。");
                  });
                })
              }
              className="rounded-full bg-bg-inverse px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              发布新任务
            </button>
            {message ? <div className="bz-brand-note rounded-2xl px-4 py-3 text-sm font-medium">{message}</div> : null}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section data-motion-reveal className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">学生行为标签</p>
          <div className="mt-5 space-y-4">
            {data.students.map((student) => (
              <div key={student.id} data-motion-card className="rounded-2xl bg-bg-muted p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-fg-default">{student.name}</p>
                    <p className="text-sm text-fg-muted">{student.title}</p>
                  </div>
                  <div className="shrink-0 text-sm text-fg-muted">
                    净值{" "}
                    {student.latestSnapshot ? (
                      <MoneyText>{formatCurrency(student.latestSnapshot.netWorth)}</MoneyText>
                    ) : (
                      "--"
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {student.signals.map((signal) => (
                    <span
                      key={signal.label}
                      className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-fg-muted"
                    >
                      {signal.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section data-motion-reveal className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">邀请码池</p>
          <div className="mt-5 space-y-3">
            {data.invites.map((invite) => (
              <div key={invite.id} data-motion-card className="rounded-2xl bg-bg-muted px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-lg font-semibold text-fg-default">{invite.label}</p>
                  <span className="bz-brand-chip shrink-0 rounded-full px-3 py-1 text-xs font-semibold">
                    {invite.code}
                  </span>
                </div>
                <p className="mt-2 text-sm text-fg-muted">剩余可用次数：{invite.usesRemaining}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
