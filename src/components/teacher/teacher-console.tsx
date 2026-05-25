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
    dueLabel: "下周三 18:00",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function refreshOverview() {
    const response = await fetch("/api/teacher/classroom", { cache: "no-store" });
    const payload = (await response.json()) as { overview?: TeacherOverview; error?: string };
    if (!response.ok || !payload.overview) {
      throw new Error(payload.error ?? "班级数据更新失败。");
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
      throw new Error(payload.error ?? "任务创建失败。");
    }
    setMessage(payload.message ?? "任务已创建。");
    await refreshOverview();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          ["班级名称", data.classroom.name],
          ["所在地区", data.classroom.region],
          ["当前主题", data.classroom.challengeTheme],
          ["校内排名", `第 ${data.classroom.schoolRank} 名`],
        ].map(([label, value]) => (
          <div key={label} className="panel rounded-[1.8rem] p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[#f08a38]">班级排行</p>
          <div className="mt-5 space-y-3">
            {data.leaderboard.map((entry) => (
              <div key={entry.userId} className="flex items-center justify-between rounded-[1.5rem] bg-slate-950/[0.03] px-4 py-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950">#{entry.rank} {entry.name}</p>
                  <p className="mt-1 text-sm text-slate-500">纪律分 {entry.disciplineScore}</p>
                </div>
                <p className="text-lg font-semibold">
                  <MoneyText>{formatCurrency(entry.netWorth)}</MoneyText>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[#f08a38]">发起任务</p>
          <div className="mt-5 space-y-4">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f08a38]"
            />
            <textarea
              value={form.brief}
              onChange={(event) => setForm((current) => ({ ...current, brief: event.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f08a38]"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                value={form.difficulty}
                onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f08a38]"
              />
              <input
                value={form.dueLabel}
                onChange={(event) => setForm((current) => ({ ...current, dueLabel: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f08a38]"
              />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  createAssignment().catch((error) => {
                    setMessage(error instanceof Error ? error.message : "任务创建失败。");
                  });
                })
              }
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              发布新任务
            </button>
            {message ? (
              <div className="rounded-[1.4rem] bg-[#fff4e9] px-4 py-3 text-sm font-medium text-[#7a4717]">
                {message}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[#f08a38]">学生行为标签</p>
          <div className="mt-5 space-y-4">
            {data.students.map((student) => (
              <div key={student.id} className="rounded-[1.5rem] bg-slate-950/[0.03] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{student.name}</p>
                    <p className="text-sm text-slate-500">{student.title}</p>
                  </div>
                  <div className="text-sm text-slate-500">
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
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      {signal.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[#f08a38]">邀请码池</p>
          <div className="mt-5 space-y-3">
            {data.invites.map((invite) => (
              <div key={invite.id} className="rounded-[1.5rem] bg-slate-950/[0.03] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-slate-950">{invite.label}</p>
                  <span className="rounded-full bg-[#fff2e4] px-3 py-1 text-xs font-semibold text-[#b45e1b]">
                    {invite.code}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">剩余可用次数：{invite.usesRemaining}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
