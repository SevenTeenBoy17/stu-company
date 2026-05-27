import { DemoPortal } from "@/components/demo/demo-portal";
import { getQuickDemoCredentials } from "@/lib/db/repo";

// UI-DEBT: Demo page still needs richer form empty/error-state review; see docs/ui-spec/audit-2026-05-25.md.
export default async function DemoPage() {
  const credentials = await getQuickDemoCredentials();
  return (
    <div className="pb-24">
      <section className="page-shell pt-8">
        <div className="bz-ink-panel overflow-hidden rounded-3xl px-6 py-8 sm:px-10 sm:py-12">
          <p className="bz-eyebrow-inverse">开始体验</p>
          <h1 className="font-display mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
            注册、登录或用样例账号，直接进入沙盘。
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/70">
            免费注册即可体验完整的 12 回合经济沙盘 + AI 行为诊断。也可使用预置的样例账号一键进入学生、教师、家长或管理端。
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--down-400)]" />
              纯教育模拟，不涉及真实交易
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--down-400)]" />
              学生端不显示任何价格信息
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--down-400)]" />
              注册数据仅用于教学反馈
            </span>
          </div>
        </div>
      </section>

      <section className="page-shell mt-8">
        <DemoPortal
          credentials={credentials}
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
