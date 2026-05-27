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

export default function PricingPage() {
  return (
    <div className="pb-24">
      <section className="page-shell pt-8">
        <SectionReveal className="text-center">
          <p className="bz-eyebrow">订阅方案</p>
          <h1 className="font-display mt-4 text-4xl font-semibold text-[var(--ink-900)] sm:text-5xl">
            一杯奶茶的价格，给孩子一学期的财商课
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--ink-500)]">
            不接触真实交易，不做开户导流。纯教育属性，家长放心，学校合规。
          </p>
        </SectionReveal>
      </section>

      <section className="page-shell mt-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <SectionReveal
              key={plan.id}
              className={`rounded-3xl border p-6 sm:p-8 ${
                plan.highlight
                  ? "border-[var(--brand)] bg-[var(--amber-50)] shadow-lg"
                  : "border-[var(--ink-200)] bg-[var(--surface)]"
              }`}
            >
              {plan.highlight && (
                <span className="mb-4 inline-block rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-white">
                  最受欢迎
                </span>
              )}
              <h2 className="text-2xl font-semibold text-[var(--ink-900)]">{plan.name}</h2>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-[var(--ink-900)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-[var(--ink-500)]">{plan.period}</span>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-500)]">{plan.description}</p>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-[var(--ink-700)]">
                    <span className="mt-0.5 text-[var(--brand)]">&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-8 block rounded-full px-6 py-3 text-center text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-[var(--brand)] text-white hover:bg-[var(--amber-600)]"
                    : "border border-[var(--ink-200)] text-[var(--ink-700)] hover:bg-[var(--ink-50)]"
                }`}
              >
                {plan.cta}
              </Link>
            </SectionReveal>
          ))}
        </div>
      </section>

      <section className="page-shell mt-16 text-center">
        <p className="text-sm text-[var(--ink-400)]">
          所有方案支持 30 天无理由退款 · 学生端不显示价格信息 · 支付由家长或教师完成
        </p>
      </section>
    </div>
  );
}
