import { redirect } from "next/navigation";

import { AdminUserManager } from "@/components/admin/admin-user-manager";
import { ManualWechatConfigCard } from "@/components/admin/manual-wechat-config-card";
import { ManualPaymentOrders } from "@/components/admin/manual-payment-orders";
import { PlatformLayout } from "@/components/platform/platform-layout";
import { isSuperAdmin } from "@/lib/auth-roles";
import { getManualWechatCollectionConfig, getManualWechatReadiness } from "@/lib/billing/manual-wechat";
import { MoneyText } from "@/components/shared/money-text";
import { getAdminOverview, roleHomePath } from "@/lib/db/repo";
import { getCurrentUser } from "@/lib/session-user";
import { formatCurrency } from "@/lib/utils";

function formatFen(value: number) {
  return formatCurrency(value / 100);
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "admin") redirect(roleHomePath(user.role));

  const overview = await getAdminOverview();
  const canManagePasswords = isSuperAdmin(user);
  const manualWechatConfig = await getManualWechatCollectionConfig();
  const manualWechatReadiness = getManualWechatReadiness(manualWechatConfig);

  const businessCards = [
    { label: "学校授权席位", value: `${overview.business.schoolLicenses}`, hint: "可用于班级与校内试点授权" },
    { label: "活跃体验用户", value: `${overview.business.trialUsers}`, hint: "处于试用窗口的普通用户" },
    { label: "订阅用户", value: `${overview.business.standardUsers}`, hint: "标准订阅或学校授权账号" },
    { label: "已确认收入", value: formatFen(overview.business.revenueFen), hint: "来自已支付订单的演示统计" },
  ];

  return (
    <PlatformLayout
      role="admin"
      heading="运营控制台"
      summary="统一管理账号、试用、订阅和课堂授权。超级管理员拥有写权限，普通管理员只读查看运营概览。"
    >
      <section data-motion-reveal className="bz-ink-panel overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <p className="bz-eyebrow-inverse">Brown Zone / Admin</p>
        <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <h2 className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              商业运营与账号权限，总览在这里完成。
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-white/68">
              当前采用“双轨商业模式”：个人月卡承接自助体验，学校授权承接批量账号、课堂数据、
              教师管理和阶段性报告。这里展示的是运营面板与账号管理入口。
            </p>
          </div>
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.06] p-5">
            <p className="text-sm font-semibold text-white/70">当前身份</p>
            <p className="mt-2 text-2xl font-black text-white">{canManagePasswords ? "超级管理员" : "普通管理员"}</p>
            <p className="mt-3 text-sm leading-7 text-white/58">
              {canManagePasswords
                ? "可以创建账号、修改邮箱、重置密码和调整订阅状态。"
                : "可查看运营数据，但无法修改账号与订阅。"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.metrics.map((metric) => (
          <div key={metric.label} data-motion-card className="panel rounded-3xl p-5">
            <p className="text-sm font-bold text-fg-muted">{metric.label}</p>
            <p className="mt-3 text-4xl font-black text-fg-default">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {businessCards.map((card) => (
          <div key={card.label} data-motion-card className="panel rounded-3xl p-5">
            <p className="bz-eyebrow">{card.label}</p>
            <p className="mt-3 text-3xl font-black text-slate-950">{card.value}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{card.hint}</p>
          </div>
        ))}
      </div>

      <ManualWechatConfigCard
        config={manualWechatConfig}
        initialReadiness={manualWechatReadiness}
        canManage={canManagePasswords}
      />

      <ManualPaymentOrders orders={overview.manualOrders ?? []} canManage={canManagePasswords} />

      <AdminUserManager users={overview.users} canManagePasswords={canManagePasswords} />

      <div className="grid gap-6 xl:grid-cols-2">
        <section data-motion-reveal className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">班级榜单头部</p>
          <div className="mt-5 space-y-3">
            {overview.topUsers.map((entry) => (
              <div key={entry.userId} data-motion-card className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-bg-muted px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-fg-default" title={entry.name}>
                    #{entry.rank} {entry.name}
                  </p>
                  <p className="text-sm font-semibold text-fg-muted">纪律分 {entry.disciplineScore}</p>
                </div>
                <p className="shrink-0 text-lg font-black">
                  <MoneyText>{formatCurrency(entry.netWorth)}</MoneyText>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section data-motion-reveal className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">最近任务</p>
          <div className="mt-5 space-y-3">
            {overview.assignments.map((assignment) => (
              <div key={assignment.id} data-motion-card className="rounded-2xl bg-bg-muted p-5">
                <p className="text-lg font-black text-fg-default">{assignment.title}</p>
                <p className="mt-2 text-sm font-semibold leading-7 text-fg-muted">{assignment.brief}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section data-motion-reveal className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">邀请码池</p>
          <div className="mt-5 space-y-3">
            {overview.invites.map((invite) => (
              <div key={invite.id} data-motion-card className="rounded-2xl bg-bg-muted px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-lg font-black text-fg-default">{invite.label}</p>
                  <span className="bz-brand-chip shrink-0 rounded-full px-3 py-1 text-xs font-black">
                    {invite.code}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section data-motion-reveal className="panel rounded-3xl p-6">
          <p className="bz-eyebrow">班级与学校授权</p>
          <div className="mt-5 space-y-3">
            {overview.classrooms.map((classroom) => (
              <div key={classroom.id} data-motion-card className="rounded-2xl bg-bg-muted p-5">
                <p className="text-lg font-black text-fg-default">{classroom.name}</p>
                <p className="mt-2 text-sm font-semibold text-fg-muted">
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
