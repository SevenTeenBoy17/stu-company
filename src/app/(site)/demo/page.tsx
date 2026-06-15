import { DemoPortal } from "@/components/demo/demo-portal";
import { getQuickDemoCredentials } from "@/lib/db/repo";

export default async function DemoPage() {
  // Security: never serialize demo passwords into the client RSC payload.
  // One-click login goes through /api/auth/demo-login (email only); the server
  // looks up the password. The client only needs label/email/trial.
  const credentials = (await getQuickDemoCredentials()).map((item) => ({
    label: item.label,
    email: item.email,
    trial: item.trial ?? false,
  }));
  return (
    <div className="pb-24">
      <section className="page-shell pt-8">
        <div className="bz-ink-panel overflow-hidden rounded-3xl px-6 py-8 sm:px-10 sm:py-12">
          <p className="bz-eyebrow-inverse">Start Brown Zone</p>
          <h1 className="font-display mt-5 max-w-5xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            一个入口，完成登录、注册、游客体验和课堂加入。
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/72">
            新用户用邮箱注册后进入沙盘体验；已有账号按角色进入对应工作台；游客可先轻量试玩；
            学校或教师发放的邀请码可用于加入对应班级与角色。
          </p>
          <div className="mt-6 grid gap-3 text-sm text-white/58 sm:grid-cols-3">
            <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              教育模拟，不接真实交易
            </span>
            <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              邮箱唯一，重复注册会提示
            </span>
            <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              登录后按权限进入工作台
            </span>
          </div>
        </div>
      </section>

      <section className="page-shell mt-8">
        <DemoPortal
          credentials={credentials}
          inviteHints={[
            {
              role: "学生试点码",
              code: "MRB-STUDENT-2026",
              note: "注册后自动加入树德实验试点班，并创建个人经济沙盘。",
            },
            {
              role: "家长绑定码",
              code: "MRB-PARENT-2026",
              note: "用于绑定学生成长报告，查看家长视角数据。",
            },
            {
              role: "教师演示码",
              code: "MRB-TEACHER-2026",
              note: "注册为教师演示账号，可查看任务与班级榜单。",
            },
          ]}
        />
      </section>
    </div>
  );
}
