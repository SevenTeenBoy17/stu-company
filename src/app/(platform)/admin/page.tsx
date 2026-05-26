import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { MoneyText } from "@/components/shared/money-text";
import { getCurrentUser } from "@/lib/session-user";
import { getAdminOverview, roleHomePath } from "@/lib/db/repo";
import { formatCurrency } from "@/lib/utils";

// UI-DEBT: Dedicated loading/empty/error states are still pending; see docs/ui-spec/audit-2026-05-25.md.
export default async function AdminPage() {
  // L3: redirect rather than render a 200 AccessGate for unauthorised roles.
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "admin") redirect(roleHomePath(user.role));

  const overview = await getAdminOverview();

  return (
    <PlatformLayout
      role="admin"
      heading="运营总览"
      summary="用于展示演示环境的整体运营面板：邀请码池、班级分布、榜单头部和任务活跃度一屏看清。"
    >
      <div className="grid gap-4 lg:grid-cols-4">
        {overview.metrics.map((metric) => (
          <div key={metric.label} className="panel rounded-3xl p-5">
            <p className="text-sm text-fg-muted">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-fg-default">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">榜单头部</p>
          <div className="mt-5 space-y-3">
            {overview.topUsers.map((entry) => (
              <div key={entry.userId} className="flex items-center justify-between rounded-2xl bg-bg-muted px-4 py-4">
                <div>
                  <p className="text-lg font-semibold text-fg-default">
                    #{entry.rank} {entry.name}
                  </p>
                  <p className="text-sm text-fg-muted">纪律分 {entry.disciplineScore}</p>
                </div>
                <p className="text-lg font-semibold">
                  <MoneyText>{formatCurrency(entry.netWorth)}</MoneyText>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">最近任务</p>
          <div className="mt-5 space-y-3">
            {overview.assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-2xl bg-bg-muted p-5">
                <p className="text-lg font-semibold text-fg-default">{assignment.title}</p>
                <p className="mt-2 text-sm leading-7 text-fg-muted">{assignment.brief}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">邀请码池</p>
          <div className="mt-5 space-y-3">
            {overview.invites.map((invite) => (
              <div key={invite.id} className="rounded-2xl bg-bg-muted px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-fg-default">{invite.label}</p>
                  <span className="bz-brand-chip rounded-full px-3 py-1 text-xs font-semibold">
                    {invite.code}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">班级清单</p>
          <div className="mt-5 space-y-3">
            {overview.classrooms.map((classroom) => (
              <div key={classroom.id} className="rounded-2xl bg-bg-muted p-5">
                <p className="text-lg font-semibold text-fg-default">{classroom.name}</p>
                <p className="mt-2 text-sm text-fg-muted">
                  {classroom.region} · 校内排名第 {classroom.schoolRank} 名
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PlatformLayout>
  );
}
