import Link from "next/link";

import { WechatCheckoutButton } from "@/components/billing/wechat-checkout-button";
import { SectionReveal } from "@/components/site/section-reveal";
import { getCurrentUser } from "@/lib/session-user";

const plans = [
  {
    id: "free",
    name: "游客体验",
    price: "免费",
    period: "",
    description: "适合第一次了解 Mr.Brown 经济沙盘，先体验核心叙事与基础 AI 反馈。",
    features: [
      "2 天完整 AI 评定",
      "最后 1 天基础 AI 提示",
      "可体验 12 回合沙盘框架",
      "试用结束后仍可查看历史",
    ],
    cta: "立即注册",
    href: "/demo",
    highlight: false,
  },
  {
    id: "standard",
    name: "标准版 · 个人",
    price: "¥15",
    period: "/月",
    description: "适合单个学生自学，开通后恢复完整 AI 财商教练能力。",
    features: [
      "12 回合完整沙盘",
      "AI 个性化行为评定 + 6 维雷达",
      "随机事件 + 决策卡全开",
      "历史复盘看板 + 排行榜",
      "1 名学生账号",
      "月度成长报告",
    ],
    cta: "开通标准版",
    href: "/demo",
    highlight: false,
  },
  {
    id: "premium",
    name: "高级版 · 家庭",
    price: "¥30",
    period: "/月",
    description: "适合家庭或进阶学习，多孩子、深度 AI 复盘与每周家长报告。",
    features: [
      "标准版全部能力",
      "家庭多账号（最多 3 名学生）",
      "AI 深度复盘 + 投资人格报告（可分享）",
      "家长成长周报 · 邮件自动推送",
      "多局存档 + 赛季重玩（换种子）",
      "满血 AI 优先，高峰不降级",
    ],
    cta: "开通高级版",
    href: "/demo",
    highlight: true,
  },
  {
    id: "school",
    name: "学校授权",
    price: "按班级",
    period: "/学期",
    description: "适合学校和教育机构，包含批量账号、教师后台、课堂数据和阶段报告。",
    features: [
      "个人月卡全部能力",
      "教师任务与班级管理",
      "批量账号与邀请码",
      "班际排行榜和挑战赛",
      "家长成长报告视图",
      "行为分析与导出",
      "定制课堂主题",
      "优先支持与培训",
    ],
    cta: "联系开通",
    href: "/demo",
    highlight: false,
  },
];

const faqs = [
  {
    q: "试用结束后数据会丢失吗？",
    a: "不会。试用结束后仍可查看历史记录和复盘报告，只是不能继续推进新回合或获取完整个性化 AI 评定。",
  },
  {
    q: "学生端会直接展示付款金额吗？",
    a: "不会。学生端保持教育模拟语境，付款入口主要由家长、教师或管理员完成。",
  },
  {
    q: "学校授权能先试点再采购吗？",
    a: "可以。教师可先带一个班级体验，确认课堂效果后再升级到学校授权。",
  },
];

export default async function PricingPage() {
  // Knowing auth server-side lets the checkout button skip the billing-status
  // prefetch for anonymous visitors (which would log a harmless 401).
  const user = await getCurrentUser();
  const authed = Boolean(user);
  return (
    <div className="pb-24">
      <section className="page-shell pt-8 sm:pt-12">
        <SectionReveal className="bz-ink-panel rounded-3xl px-6 py-10 text-center sm:px-10 sm:py-14">
          <p className="bz-eyebrow-inverse">订阅方案</p>
          <h1 className="font-display mx-auto mt-5 max-w-3xl text-display-lg font-semibold leading-tight sm:text-display-xl">
            个人月卡 + 学校授权，兼顾自助体验和课堂规模化。
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/70">
            不接触真实交易，不做开户导流。产品以教育模拟、AI 复盘和家校共育为核心。
          </p>
        </SectionReveal>
      </section>

      <section className="page-shell -mt-8 sm:-mt-10">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
              {plan.highlight ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand)] px-4 py-1 text-xs font-bold text-white shadow-md">
                  推荐体验
                </span>
              ) : null}
              <h2 className="text-xl font-semibold text-[var(--ink-900)]">{plan.name}</h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl font-bold text-[var(--ink-900)] tabular-nums">
                  {plan.price}
                </span>
                {plan.period ? <span className="text-sm text-[var(--ink-500)]">{plan.period}</span> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-500)]">{plan.description}</p>

              <div className="my-6 h-px bg-[var(--ink-100)]" />

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-[var(--ink-700)]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--amber-100)] text-xs text-[var(--amber-700)]">
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.id === "standard" || plan.id === "premium" ? (
                <WechatCheckoutButton tier={plan.id as "standard" | "premium"} authed={authed} />
              ) : (
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
              )}
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
            <SectionReveal
              key={faq.q}
              delay={index * 0.05}
              className="rounded-2xl border border-[var(--ink-200)] bg-[var(--surface)] px-6 py-5"
            >
              <p className="text-sm font-semibold text-[var(--ink-900)]">{faq.q}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ink-500)]">{faq.a}</p>
            </SectionReveal>
          ))}
        </div>
      </section>

      <section className="page-shell mt-12 text-center">
        <p className="text-xs text-[var(--ink-400)]">
          个人月卡用于自助体验 · 学校授权用于批量账号和课堂管理 · 学生端不直接展示付款金额
        </p>
      </section>
    </div>
  );
}
