import { LearnCatalog } from "@/components/site/learn-catalog";

export default function LearnPage() {
  return (
    <div className="pb-24">
      <section className="page-shell pt-8">
        <div className="overflow-hidden rounded-[2.6rem] bg-[#0b1020] px-6 py-8 text-white shadow-[0_30px_90px_rgba(11,16,32,0.34)] sm:px-10 sm:py-12">
          <p className="text-sm uppercase tracking-[0.28em] text-[#f08a38]">课程矩阵</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
                通过 Brown Zone 课程，把“学会概念”升级为“敢做决策”。
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/68">
                页面结构参考了你提供的 TradingKey 学习页，但所有视觉与插画都重新设计为 Brown Zone 的产品语言，更强调课堂试点与模拟实操感。
              </p>
            </div>
            <div className="grid-strokes rounded-[2rem] border border-white/8 bg-white/[0.04] p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["8 大模块", "覆盖股市、储蓄、房产、创业与家校协同。"],
                  ["12 回合赛季", "每回合都有新的市场主题与事件卡。"],
                  ["AI 行为诊断", "实时提醒追涨杀跌、仓位失衡与现金流压力。"],
                  ["邀请制闭环", "教师发码，学生注册，家长绑定，管理员总览。"],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-[1.5rem] border border-white/8 bg-white/[0.05] p-5">
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
