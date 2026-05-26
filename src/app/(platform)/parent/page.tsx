import { PlatformLayout } from "@/components/platform/platform-layout";
import { AccessGate } from "@/components/shared/access-gate";
import { getCurrentUser } from "@/lib/session-user";
import { getParentOverview } from "@/lib/db/repo";

// UI-DEBT: Dedicated loading/empty/error states are still pending; see docs/ui-spec/audit-2026-05-25.md.
export default async function ParentPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "parent") {
    return (
      <div className="page-shell py-10">
        <AccessGate
          title="家长成长报告需要家长账号登录"
          description="请从试玩入口使用家长样例账号登录，或通过家长邀请码注册绑定。这里会展示学生净值趋势、能力雷达和老师总结。"
        />
      </div>
    );
  }

  const overview = await getParentOverview(user.id);

  return (
    <PlatformLayout
      role="parent"
      heading="家长成长报告"
      summary="家长端关注的不是短线收益，而是孩子面对不确定性时是否更理性、更有计划，也更愿意复盘。"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">绑定学生</p>
          <h2 className="mt-4 text-3xl font-semibold text-fg-default">{overview.student.name}</h2>
          <p className="mt-3 text-base leading-8 text-fg-muted">{overview.student.title}</p>
          <div className="mt-6 rounded-2xl bg-bg-inverse p-5 text-white">
            <p className="text-sm leading-8 text-white/76">{overview.report.aiSummary}</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {overview.report.competencies.map((item) => (
              <div key={item.label} className="rounded-2xl bg-bg-muted p-5">
                <p className="text-sm text-fg-muted">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-fg-default">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">学期成长轨迹</p>
          <div className="mt-6 rounded-3xl bg-bg-inverse p-6 text-white">
            <div className="flex h-56 items-end gap-3">
              {overview.report.netWorthTrend.map((value, index, array) => {
                const max = Math.max(...array);
                return (
                  <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center gap-3">
                    <div className="w-full rounded-t-2xl bg-brand" style={{ height: `${(value / max) * 100}%` }} />
                    <span className="text-xs text-white/55">R{index + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-bg-muted p-5">
            <p className="text-lg font-semibold text-fg-default">教师评语</p>
            <p className="mt-3 text-sm leading-7 text-fg-muted">{overview.report.teacherComment}</p>
          </div>
          <div className="mt-4 rounded-2xl bg-bg-muted p-5">
            <p className="text-lg font-semibold text-fg-default">最近回合反思</p>
            <p className="mt-3 text-sm leading-7 text-fg-muted">{overview.run.lastInsight}</p>
          </div>
        </section>
      </div>
    </PlatformLayout>
  );
}
