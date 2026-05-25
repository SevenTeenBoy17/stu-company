import { PlatformLayout } from "@/components/platform/platform-layout";
import { AccessGate } from "@/components/shared/access-gate";
import { MoneyText } from "@/components/shared/money-text";
import { getCurrentUser } from "@/lib/session-user";
import { getAdminOverview } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return (
      <div className="page-shell py-10">
        <AccessGate
          title="管理端需要管理员账号登录"
          description="请先从试玩入口使用管理员样例账号登录。这里会展示邀请码池、示范班级、热门用户和最近发布的任务。"
        />
      </div>
    );
  }

  const overview = getAdminOverview();

  return (
    <PlatformLayout
      role="admin"
      heading="运营总览"
      summary="用于展示演示环境的整体运营面板：邀请码池、班级分布、榜单头部和任务活跃度一屏看清。"
    >
      <div className="grid gap-4 lg:grid-cols-4">
        {overview.metrics.map((metric) => (
          <div key={metric.label} className="panel rounded-[1.8rem] p-5">
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[#f08a38]">榜单头部</p>
          <div className="mt-5 space-y-3">
            {overview.topUsers.map((entry) => (
              <div key={entry.userId} className="flex items-center justify-between rounded-[1.5rem] bg-slate-950/[0.03] px-4 py-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950">#{entry.rank} {entry.name}</p>
                  <p className="text-sm text-slate-500">纪律分 {entry.disciplineScore}</p>
                </div>
                <p className="text-lg font-semibold">
                  <MoneyText>{formatCurrency(entry.netWorth)}</MoneyText>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[#f08a38]">最近任务</p>
          <div className="mt-5 space-y-3">
            {overview.assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-[1.5rem] bg-slate-950/[0.03] p-5">
                <p className="text-lg font-semibold text-slate-950">{assignment.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{assignment.brief}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[#f08a38]">邀请码池</p>
          <div className="mt-5 space-y-3">
            {overview.invites.map((invite) => (
              <div key={invite.id} className="rounded-[1.5rem] bg-slate-950/[0.03] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-slate-950">{invite.label}</p>
                  <span className="rounded-full bg-[#fff2e4] px-3 py-1 text-xs font-semibold text-[#b45e1b]">
                    {invite.code}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel rounded-[2rem] p-6">
          <p className="text-sm uppercase tracking-[0.22em] text-[#f08a38]">班级清单</p>
          <div className="mt-5 space-y-3">
            {overview.classrooms.map((classroom) => (
              <div key={classroom.id} className="rounded-[1.5rem] bg-slate-950/[0.03] p-5">
                <p className="text-lg font-semibold text-slate-950">{classroom.name}</p>
                <p className="mt-2 text-sm text-slate-500">{classroom.region} · 校内排名第 {classroom.schoolRank} 名</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PlatformLayout>
  );
}
