import Link from "next/link";

import { HeroStageArt } from "@/components/site/hero-stage-art";
import { ModuleIllustration } from "@/components/site/module-illustration";
import { SectionReveal } from "@/components/site/section-reveal";
import { StockTickerTape } from "@/components/site/stock-ticker-tape";
import {
  comparisonRows,
  learningModules,
  roadmapPhases,
  showcaseStats,
  teamProfiles,
} from "@/lib/content";
import { getTickerTapePayload } from "@/lib/market-data";

export default async function HomePage() {
  const tickerPayload = await getTickerTapePayload();

  return (
    <div className="overflow-x-clip pb-20 sm:pb-24">
      <StockTickerTape initialPayload={tickerPayload} />

      <section className="page-shell grid gap-6 pt-6 md:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pt-10">
        <SectionReveal className="bz-ink-panel rounded-3xl px-5 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <p className="bz-eyebrow-inverse">AI 驱动决策 · 沉浸式市场模拟</p>
          <h1 className="font-display mt-5 max-w-3xl text-display-lg font-semibold leading-tight sm:mt-6 sm:text-display-xl lg:text-display-2xl">
            用 AI 把经济学装进游戏里，让课堂真正进入决策现场。
          </h1>
          <p className="mt-5 max-w-2xl text-body leading-7 text-white/70 sm:mt-6 sm:text-body-lg sm:leading-8">
            Brown Zone 以 Mr.Brown AI 经济沙盘为核心，把经济学考点、资产配置、家校共育和排行榜挑战做成一体化网页端体验。
          </p>
          <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">
            <Link href="/demo" className="bz-primary-action px-6 py-3 text-sm">
              进入试玩入口
            </Link>
            <Link href="/learn" className="rounded-full border border-white/12 px-6 py-3 text-sm font-semibold text-white">
              查看 8 大模块
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3">
            {showcaseStats.map((stat) => (
              <div key={stat.label} className="bz-inverse-tile p-5">
                <p className="text-caption uppercase tracking-wide text-white/40">{stat.label}</p>
                <p className="mt-3 text-2xl font-semibold text-white">{stat.value}</p>
                <p className="mt-2 text-sm leading-6 text-white/60">{stat.detail}</p>
              </div>
            ))}
          </div>
        </SectionReveal>

        <SectionReveal
          delay={0.08}
          className="bz-ink-panel relative min-h-[440px] overflow-hidden rounded-3xl sm:min-h-[560px] lg:min-h-[620px]"
        >
          <HeroStageArt className="absolute inset-0" />
          <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-lg sm:inset-x-8 sm:bottom-8 sm:rounded-3xl sm:p-5">
            <p className="bz-eyebrow-inverse">Product Promise</p>
            <p className="mt-3 text-lg font-semibold text-white">展示优先版首发聚焦</p>
            <p className="mt-2 text-sm leading-7 text-white/62">
              官网叙事、课程模块、试玩入口、家校协同和邀请制闭环全部可跑通；内部工作台需登录后按账号权限进入。
            </p>
          </div>
        </SectionReveal>
      </section>

      <section id="method" className="page-shell mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          ["学", "把 AP / 国标经济学拆成剧情式微任务，降低理解门槛。"],
          ["用", "在 12 回合市场中交易、储蓄、买房和创业，低成本试错。"],
          ["评", "AI 导师与成长报告同步给出行为偏差与下一回合建议。"],
        ].map(([title, text], index) => (
          <SectionReveal key={title} delay={index * 0.06} className="panel rounded-3xl p-6">
            <p className="bz-eyebrow">0{index + 1}</p>
            <h2 className="mt-4 text-3xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-3 text-base leading-8 text-slate-600">{text}</p>
          </SectionReveal>
        ))}
      </section>

      <section className="page-shell mt-14 sm:mt-16">
        <SectionReveal className="flex flex-col gap-3">
          <p className="bz-eyebrow">核心功能</p>
          <h2 className="font-display text-4xl font-semibold text-slate-950">
            8 大模块围绕一套完整沙盘协同运转
          </h2>
          <p className="max-w-3xl text-base leading-8 text-slate-600">
            从资产配置到家校后台，每一块都按可展示、可试玩、可扩展的方式重新组织，避免只停留在静态介绍。
          </p>
        </SectionReveal>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {learningModules.map((module, index) => (
            <SectionReveal
              key={module.key}
              delay={(index % 4) * 0.04}
              className="panel overflow-hidden rounded-3xl"
            >
              <div className="bg-bg-muted p-4">
                <ModuleIllustration moduleKey={module.key} className="h-52 w-full" />
              </div>
              <div className="p-6">
                <div className="bz-brand-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold">
                  {module.level}
                </div>
                <h3 className="mt-4 text-2xl font-semibold text-slate-950">{module.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{module.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {module.highlights.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </SectionReveal>
          ))}
        </div>
      </section>

      <section className="page-shell mt-14 grid gap-6 lg:mt-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionReveal className="bz-ink-panel rounded-3xl p-8">
          <p className="bz-eyebrow-inverse">方案优势</p>
          <h2 className="mt-4 font-display text-4xl font-semibold">
            为什么它比传统财商课更像下一代课堂产品？
          </h2>
          <div className="mt-8 space-y-4">
            {comparisonRows.map((row) => (
              <div key={row.label} className="bz-inverse-tile p-5">
                <p className="text-lg font-semibold text-white">{row.label}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <p className="rounded-2xl bg-white/[0.04] p-4 text-sm leading-7 text-white/55">{row.traditional}</p>
                  <p className="rounded-2xl bg-brand/10 p-4 text-sm leading-7 text-white/80">{row.brownZone}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionReveal>

        <div className="space-y-6">
          <SectionReveal className="panel rounded-3xl p-7">
            <p className="bz-eyebrow">增长路径</p>
            <h3 className="mt-4 text-3xl font-semibold text-slate-950">
              先做校内试点，再把联赛与 SaaS 做成增长飞轮
            </h3>
            <div className="mt-6 space-y-4">
              {roadmapPhases.map((phase, index) => (
                <div key={phase.title} className="bz-muted-tile p-5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-9 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="text-lg font-semibold text-slate-950">{phase.title}</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{phase.detail}</p>
                </div>
              ))}
            </div>
          </SectionReveal>

          <SectionReveal id="business" className="panel rounded-3xl p-7">
            <p className="bz-eyebrow">商业模式</p>
            <h3 className="mt-4 text-3xl font-semibold text-slate-950">
              个人月卡 + 学校授权 + 赛事服务
            </h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["个人月卡", "15 元/月，用于自助体验、AI 评定和成长复盘。"],
                ["学校授权", "按班级或学期授权，包含教师后台、批量账号和课堂数据。"],
                ["赛事服务", "校际挑战、主题赛与阶段证书形成额外服务收入。"],
              ].map(([title, text]) => (
                <div key={title} className="bz-muted-tile p-5">
                  <p className="text-lg font-semibold text-slate-950">{title}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </SectionReveal>
        </div>
      </section>

      <section id="safety" className="page-shell mt-14 grid gap-6 lg:mt-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <SectionReveal className="panel rounded-3xl p-7">
          <p className="bz-eyebrow">团队与愿景</p>
          <h2 className="mt-4 text-4xl font-semibold text-slate-950">
            以游戏为载体，做真正对同龄人有帮助的经济学启蒙
          </h2>
          <div className="mt-6 space-y-4">
            {teamProfiles.map((member) => (
              <div key={member.name} className="bz-muted-tile p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-semibold text-slate-950">{member.name}</p>
                  <span className="bz-brand-chip rounded-full px-3 py-1 text-xs font-semibold">
                    {member.role}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{member.summary}</p>
              </div>
            ))}
          </div>
        </SectionReveal>

        <SectionReveal className="bz-ink-panel bz-ink-gradient rounded-3xl p-8">
          <p className="bz-eyebrow-inverse">未成年人友好</p>
          <h2 className="mt-4 font-display text-4xl font-semibold">
            坚持去金钱化、去开户导流，把“玩”变成理性训练
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              "不接真实行情交易，不做任何真实收益承诺。",
              "课堂、家庭与 AI 报告围绕成长反馈，而不是刺激频繁操作。",
              "邀请码与班级关系可控，适合校园试点与展示环境。",
              "联赛先做异步排行榜，不做鼓励冲动行为的实时对战房间。",
            ].map((item) => (
              <div key={item} className="bz-inverse-tile p-5 text-sm leading-7 text-white/72">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="bz-primary-action px-6 py-3 text-sm">
              打开 Demo 闭环
            </Link>
            <Link href="/pricing" className="rounded-full border border-white/12 px-6 py-3 text-sm font-semibold text-white">
              查看商业方案
            </Link>
          </div>
        </SectionReveal>
      </section>
    </div>
  );
}
