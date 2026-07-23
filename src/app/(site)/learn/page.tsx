import { LearnCatalog } from "@/components/site/learn-catalog";

// UI-DEBT: Learn page still needs a dedicated route-level loading/error state; see docs/ui-spec/audit-2026-05-25.md.
export default function LearnPage() {
  return (
    <div className="pb-24">
      <section className="page-shell pt-8">
        <div data-motion-reveal className="bz-ink-panel overflow-hidden rounded-3xl px-6 py-8 sm:px-10 sm:py-12">
          <p className="bz-eyebrow-inverse">课程矩阵</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
                通过 Brown Zone 课程，把“学会概念”升级为“敢做决策”。
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/68">
                8 大模块把考点变成任务流：先看懂，再上手，最后拿到 AI 复盘。
              </p>
            </div>
            {/* 交付门审计：外层只留 grid-strokes 底纹，避免与内层统计卡双层 bz-inverse-tile 嵌套。 */}
            <div className="grid-strokes p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["8 大模块", "覆盖股市、储蓄、房产、创业与家校协同。"],
                  ["12 回合赛季", "每回合都有新的市场主题与事件卡。"],
                  ["AI 行为诊断", "实时提醒追涨杀跌、仓位失衡与现金流压力。"],
                  ["邀请制闭环", "教师发码，学生注册，家长绑定，管理员总览。"],
                ].map(([title, text]) => (
                  <div key={title} data-motion-card className="bz-inverse-tile p-5">
                    <p className="text-lg font-semibold text-white">{title}</p>
                    <p className="mt-2 text-sm leading-7 text-white/58">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell mt-8">
        <LearnCatalog />
      </section>
    </div>
  );
}
