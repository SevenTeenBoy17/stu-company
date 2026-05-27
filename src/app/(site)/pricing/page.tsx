import Link from "next/link";

import { SectionReveal } from "@/components/site/section-reveal";

const plans = [
  {
    id: "free",
    name: "游客体验",
    price: "免费",
    period: "",
    description: "注册即可体验，快速了解 Mr.Brown 经济沙盘。",
    features: [
      "1 天全功能试用",
      "2 天 AI 基础版诊断",
      "12 回合沙盘体验",
      "基础行为信号检测",
    ],
    cta: "立即注册",
    href: "/demo",
    highlight: false,
  },
  {
    id: "standard",
    name: "标准版",
    price: "¥15",
    period: "/月",
    description: "适合个人学生和家庭，完整的 AI 财商教练体验。",
    features: [
      "12 回合完整沙盘",
      "AI 个性化行为诊断",
      "6 维能力雷达图",
      "历史复盘看板",
      "排行榜参与",
      "月度成长报告",
    ],
    cta: "开通标准版",
    href: "/demo",
    highlight: true,
  },
  {
    id: "premium",
    name: "校园旗舰版",
    price: "¥299",
    period: "/学期/班级",
    description: "适合学校和教育机构，包含教师端与家长端完整功能。",
    features: [
      "标准版全部功能",
      "教师指挥舱",
      "多班级管理",
      "班际排行与挑战赛",
      "家长成长报告推送",
      "行为分析报告导出",
      "定制赛事主题",
      "优先客服支持",
    ],
    cta: "联系我们",
    href: "/demo",
    highlight: false,
  },
];

const faqs = [
  { q: "试用结束后我的数据会丢失吗？", a: "不会。试用结束后你仍然可以查看历史记录和复盘报告，只是无法进行新的操作。升级后立即恢复完整功能。" },
  { q: "学生可以自己付款吗？", a: "不可以。所有支付必须由家长或教师账号完成，学生端不显示任何价格信息。" },
  { q: "校园版可以先试用再采购吗？", a: "可以。教师可以先用免费版带一个班级体验，确认效果后再升级到校园旗舰版。" },
];

export default function PricingPage() {
  return (
    <div className="pb-24">
      <section className="page-shell pt-8 sm:pt-12">
        <SectionReveal className="bz-ink-panel rounded-3xl px-6 py-10 text-center sm:px-10 sm:py-14">
          <p className="bz-eyebrow-inverse">订阅方案</p>
          <h1 className="font-display mx-auto mt-5 max-w-3xl text-display-lg font-semibold leading-tight sm:text-display-xl">
            一杯奶茶的价格，给孩子一学期的财商课
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/70">
            不接触真实交易，不做开户导流。纯教育属性，家长放心，学校合规。30 天无理由退款。
          </p>
        </SectionReveal>
      </section>

      <section className="page-shell -mt-8 sm:-mt-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <SectionReveal
              key={plan.id}
              delay={index * 0.06}
              className={`rounded-3xl p-6 sm:p-8 ${
                plan.highlight
                  ? "relative border-2 border-[var(--brand)] bg-[var(--surface)] shadow-xl ring-1 ring-[var(--amber-200)] lg:-mt-4 lg:mb-4"
                  : "border border-[var(--ink-200)] bg-[var(--surface)]"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand)] px-4 py-1 text-xs font-bold text-white shadow-md">
                  最受欢迎
                </span>
              )}
              <h2 className="text-xl font-semibold text-[var(--ink-900)]">{plan.name}</h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl font-bold text-[var(--ink-900)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-[var(--ink-500)]">{plan.period}</span>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-500)]">{plan.description}</p>

              <div className="my-6 h-px bg-[var(--ink-100)]" />

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-[var(--ink-700)]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--amber-100)] text-xs text-[var(--amber-700)]">
                      &#10003;
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-8 block rounded-full px-6 py-3 text-center text-sm font-semibold transition-all ${
                  plan.highlight
                    ? "bg-[var(--brand)] text-white shadow-md hover:bg-[var(--amber-600)] hover:shadow-lg"
                    : "border border-[var(--ink-200)] text-[var(--ink-700)] hover:border-[var(--ink-300)] hover:bg-[var(--ink-50)]"
                }`}
              >
                {plan.cta}
              </Link>
            </SectionReveal>
          ))}
        </div>
      </section>

      <section className="page-shell mt-16">
        <SectionReveal className="text-center">
          <p className="bz-eyebrow">常见问题</p>
          <h2 className="font-display mt-4 text-3xl font-semibold text-[var(--ink-900)]">家长和老师常问的问题</h2>
        </SectionReveal>
        <div className="mx-auto mt-8 max-w-2xl space-y-4">
          {faqs.map((faq, index) => (
            <SectionReveal key={faq.q} delay={index * 0.05} className="rounded-2xl border border-[var(--ink-200)] bg-[var(--surface)] px-6 py-5">
              <p className="text-sm font-semibold text-[var(--ink-900)]">{faq.q}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-500)]">{faq.a}</p>
            </SectionReveal>
          ))}
        </div>
      </section>

      <section className="page-shell mt-12 text-center">
        <p className="text-xs text-[var(--ink-400)]">
          所有方案支持 30 天无理由退款 · 学生端不显示价格信息 · 支付由家长或教师完成
        </p>
      </section>
    </div>
  );
}
