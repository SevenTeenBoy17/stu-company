import { redirect } from "next/navigation";

import { FamilyManager } from "@/components/parent/family-manager";
import { PlatformLayout } from "@/components/platform/platform-layout";
import { getCurrentUser } from "@/lib/session-user";
import { getParentOverview, roleHomePath } from "@/lib/db/repo";

// UI-DEBT: Dedicated loading/empty/error states are still pending; see docs/ui-spec/audit-2026-05-25.md.
export default async function ParentPage() {
  // L3: redirect rather than render a 200 AccessGate for unauthorised roles.
  const user = await getCurrentUser();
  if (!user) redirect(`/demo?auth=login&reason=login_required&next=${encodeURIComponent("/parent")}`);
  if (user.role !== "parent") redirect(roleHomePath(user.role));

  const overview = await getParentOverview(user.id);

  return (
    <PlatformLayout
      role="parent"
      heading="家长成长报告"
      summary="家长端关注的不是短线收益，而是孩子面对不确定性时是否更理性、更有计划，也更愿意复盘。"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section data-motion-reveal className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">绑定学生</p>
          <h2 className="mt-4 text-3xl font-semibold text-fg-default">{overview.student.name}</h2>
          <p className="mt-3 text-base leading-8 text-fg-muted">{overview.student.title}</p>
          <div className="mt-6 rounded-2xl bg-bg-inverse p-5 text-white">
            <p className="text-sm leading-8 text-white/76">{overview.report.aiSummary}</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {overview.report.competencies.map((item) => (
              <div key={item.label} data-motion-card className="rounded-2xl bg-bg-muted p-5">
                <p className="text-sm text-fg-muted">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-fg-default">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section data-motion-reveal className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">学期成长轨迹</p>
          <div data-motion-viz className="mt-6 rounded-3xl bg-bg-inverse p-6 text-white">
            {/* QA-FIX 2026-05-26: previous markup put each bar's percentage height
                inside a wrapper without an explicit height → percentage resolved
                to 0 and the chart looked empty. Wrapper now stretches to h-56
                so the bar height percentages have something to be relative to. */}
            {/* itest9 a11y P3(1.1.1)：纯 div 柱状图对读屏只剩「R1 R2…」轴标签、丢了金额。
                给图容器 role=img + 汇总各回合净资产的 aria-label，把趋势数据补回无障碍树。 */}
            <div
              className="flex h-56 items-end gap-3"
              role="img"
              aria-label={`学期净资产走势，共 ${overview.report.netWorthTrend.length} 回合：${overview.report.netWorthTrend
                .map((value, index) => `第${index + 1}回合 ¥${value.toLocaleString("zh-CN")}`)
                .join("，")}`}
            >
              {overview.report.netWorthTrend.map((value, index, array) => {
                const max = Math.max(...array);
                const min = Math.min(...array);
                const range = max - min;
                // Scale to the data's actual min–max, not a 0-based axis: net-worth
                // values sit in a narrow high band, so a 0-based axis made every bar
                // ~full height (a solid block). Map min→12%, max→100% so the
                // round-to-round trend is actually visible.
                const heightPercent = range > 0 ? 12 + ((value - min) / range) * 88 : 60;
                return (
                  <div
                    key={`${value}-${index}`}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-3"
                  >
                    <div
                      data-motion-viz-bar
                      data-motion-origin="center bottom"
                      className="w-full rounded-t-2xl bg-brand"
                      style={{ height: `${heightPercent}%` }}
                      title={`R${index + 1}：¥${value.toLocaleString("zh-CN")}`}
                    />
                    <span className="text-xs text-white/55">R{index + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div data-motion-card className="mt-6 rounded-2xl bg-bg-muted p-5">
            <p className="text-lg font-semibold text-fg-default">教师评语</p>
            <p className="mt-3 text-sm leading-7 text-fg-muted">{overview.report.teacherComment}</p>
          </div>
          <div data-motion-card className="mt-4 rounded-2xl bg-bg-muted p-5">
            <p className="text-lg font-semibold text-fg-default">最近回合反思</p>
            <p className="mt-3 text-sm leading-7 text-fg-muted">{overview.run.lastInsight}</p>
          </div>
        </section>
      </div>

      <div className="mt-6">
        <FamilyManager />
      </div>
    </PlatformLayout>
  );
}
