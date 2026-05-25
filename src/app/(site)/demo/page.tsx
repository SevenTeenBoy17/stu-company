import { DemoPortal } from "@/components/demo/demo-portal";
import { getQuickDemoCredentials } from "@/lib/store";

export default function DemoPage() {
  return (
    <div className="pb-24">
      <section className="page-shell pt-8">
        <div className="overflow-hidden rounded-[2.6rem] bg-[#0b1020] px-6 py-8 text-white shadow-[0_30px_90px_rgba(11,16,32,0.34)] sm:px-10 sm:py-12">
          <p className="text-sm uppercase tracking-[0.28em] text-[#f08a38]">Demo Portal</p>
          <h1 className="font-display mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
            邀请制、样例账号与多角色闭环，都从这里进入。
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/70">
            为了让你能快速验收整套产品，这里同时提供真实的邀请码注册流程和预置样例账号。登录后会自动跳到学生、教师、家长或管理端。
          </p>
        </div>
      </section>

      <section className="page-shell mt-8">
        <DemoPortal
          credentials={getQuickDemoCredentials()}
          inviteHints={[
            { role: "学生试点码", code: "MRB-STUDENT-2026", note: "注册后自动加入树德实验试点班，并创建个人沙盘。" },
            { role: "家长绑定码", code: "MRB-PARENT-2026", note: "用于绑定已存在的学生成长报告，查看家长视角。" },
            { role: "教师演示码", code: "MRB-TEACHER-2026", note: "注册为教师演示账号，可查看任务与榜单管理。" },
          ]}
        />
      </section>
    </div>
  );
}
