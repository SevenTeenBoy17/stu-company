import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

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
import { moduleArt } from "@/lib/module-art";

// UI v2 三幕叙事（学 → 练 → 看见成长）：桌面端 data-motion-story pin 滚动
// 交叉淡切，移动端/减动效自然平铺。文案按 Phase 0 审计压缩成一句话主张。
const STORY_ACTS = [
  {
    act: "01",
    title: "学",
    line: "把经济学考点拆成剧情式微任务",
    image: "/brand/v2/story-learn.webp",
    alt: "Mr.Brown 萌宠在发光的大书前学习，身边漂浮着金币、幼苗与盾牌图标",
  },
  {
    act: "02",
    title: "练",
    line: "12 回合真实节奏市场，低成本试错",
    image: "/brand/v2/story-practice.webp",
    alt: "Mr.Brown 萌宠坐在迷你交易台前，三块彩色屏幕上显示上升的简洁图表",
  },
  {
    act: "03",
    title: "看见成长",
    line: "AI 导师点评 + 成长报告，看见习惯变化",
    image: "/brand/v2/story-growth.webp",
    alt: "Mr.Brown 萌宠站在金币阶梯讲台上举着小奖杯，周围飘着彩带",
  },
] as const;

export default async function HomePage() {
  const tickerPayload = await getTickerTapePayload();

  return (
    <div className="overflow-x-clip pb-20 sm:pb-24">
      <StockTickerTape initialPayload={tickerPayload} />

      <section className="page-shell grid gap-6 pt-6 md:gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pt-10">
        <SectionReveal className="bz-ink-panel rounded-3xl px-5 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <p className="bz-eyebrow-inverse">AI 驱动决策 · 沉浸式市场模拟</p>
          <h1
            data-motion-split="lines"
            className="font-display mt-5 max-w-3xl text-display-lg font-semibold leading-tight sm:mt-6 sm:text-display-xl lg:text-display-2xl"
          >
            用 AI 把经济学装进游戏里，让课堂真正进入决策现场。
          </h1>
          <p className="mt-5 max-w-2xl text-body leading-7 text-white/70 sm:mt-6 sm:text-body-lg sm:leading-8">
            以 Mr.Brown AI 经济沙盘为核心的一体化网页端财商课堂。
          </p>
          <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">
            <Link
              href="/demo"
              data-motion-button
              data-motion-magnetic
              className="bz-primary-action px-6 py-3 text-sm"
            >
              进入试玩入口
            </Link>
            <Link
              href="/learn"
              data-motion-button
              className="rounded-full border border-white/12 px-6 py-3 text-sm font-semibold text-white"
            >
              查看 8 大模块
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3">
            {showcaseStats.map((stat) => (
              <div key={stat.label} data-motion-card className="bz-inverse-tile p-5">
                <p className="text-caption uppercase tracking-wide text-white/70">{stat.label}</p>
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
          <Image
            src="/brand/v2/hero-classroom-market.webp"
            alt="晨光教室的课桌上，一座微缩全息金融城从翻开的课本里升起，Mr.Brown 萌宠举着教鞭站在旁边"
            fill
            priority
            sizes="(min-width: 1024px) 46vw, 100vw"
            className="object-cover"
          />
          <div
            data-motion-card
            className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 backdrop-blur-lg sm:inset-x-8 sm:bottom-8 sm:rounded-3xl sm:p-5"
          >
            <p className="bz-eyebrow-inverse">Mr.Brown 经济沙盘</p>
            <p className="mt-2 text-lg font-semibold text-white">课堂即市场，决策即成长。</p>
          </div>
        </SectionReveal>
      </section>

      <section id="method" className="page-shell mt-14 sm:mt-16">
        <SectionReveal className="flex flex-col gap-3">
          <p className="bz-eyebrow">学 · 练 · 看见成长</p>
          <h2 className="font-display text-4xl font-semibold text-slate-950">一套沙盘，三幕成长</h2>
        </SectionReveal>

        <div data-motion-story className="mt-6">
          {STORY_ACTS.map((act) => (
            <div
              key={act.act}
              data-motion-story-step
              className="grid items-center gap-8 py-10 lg:min-h-[68vh] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:py-0"
            >
              <div>
                <p className="text-8xl font-black leading-none text-brand/25 [font-variant-numeric:tabular-nums]">
                  {act.act}
                </p>
                <h3 className="mt-4 text-4xl font-semibold text-slate-950 sm:text-5xl">{act.title}</h3>
                <p className="mt-4 max-w-md text-lg leading-8 text-slate-600">{act.line}</p>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-black/5 bg-bg-muted lg:aspect-auto lg:h-[52vh]">
                <Image
                  src={act.image}
                  alt={act.alt}
                  fill
                  sizes="(min-width: 1024px) 52vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="page-shell mt-14 sm:mt-16">
        <SectionReveal className="flex flex-col gap-3">
          <p className="bz-eyebrow">核心功能</p>
          <h2 className="font-display text-4xl font-semibold text-slate-950">
            8 大模块围绕一套完整沙盘协同运转
          </h2>
        </SectionReveal>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {learningModules.map((module, index) => (
            <SectionReveal
              key={module.key}
              delay={(index % 4) * 0.04}
              className="panel flex flex-col overflow-hidden rounded-3xl transition-shadow duration-200 hover:shadow-[0_22px_56px_rgba(15,23,42,0.12)]"
            >
              <a
                href={module.href}
                target="_blank"
                rel="noopener noreferrer"
                data-motion-card
                aria-label={`深入学习「${module.title}」— 前往${module.hrefLabel}（在新标签页打开）`}
                className="group flex flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                <div className="relative h-52 w-full bg-bg-muted">
                  <Image
                    src={moduleArt[module.key]?.src ?? "/brand/v2/learn-market.webp"}
                    alt={moduleArt[module.key]?.alt ?? module.title}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="bz-brand-chip inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold">
                    {module.level}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold text-slate-950 transition-colors group-hover:text-brand-ink">
                    {module.title}
                  </h3>
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
                  <span className="mt-auto inline-flex items-center gap-1.5 self-start pt-5 text-sm font-bold text-brand-ink transition-all group-hover:gap-2.5">
                    前往 {module.hrefLabel}
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </a>
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
              <div key={row.label} data-motion-card className="bz-inverse-tile p-5">
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
                <div key={phase.title} data-motion-card className="bz-muted-tile p-5">
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
                <div key={title} data-motion-card className="bz-muted-tile p-5">
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
              <div key={member.name} data-motion-card className="bz-muted-tile p-5">
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
              <div key={item} data-motion-card className="bz-inverse-tile p-5 text-sm leading-7 text-white/72">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" data-motion-button className="bz-primary-action px-6 py-3 text-sm">
              打开 Demo 闭环
            </Link>
            <Link
              href="/pricing"
              data-motion-button
              className="rounded-full border border-white/12 px-6 py-3 text-sm font-semibold text-white"
            >
              查看商业方案
            </Link>
          </div>
        </SectionReveal>
      </section>
    </div>
  );
}
