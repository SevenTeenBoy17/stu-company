"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  {
    id: "welcome",
    title: "你好，新同学",
    mrBrown: "我是 Mr.Brown，你的理财教练。接下来我会用 5 分钟带你认识这个沙盘 — 别担心，不用真钱。",
    visual: "wave",
    action: "开始探索",
  },
  {
    id: "capital",
    title: "你有 12 万启动资金",
    mrBrown: "想象这是你的班费基金。你的任务是在 12 个回合内，通过买卖、储蓄和投资让它增长。怎么分配，全由你说了算。",
    visual: "cash",
    highlight: "cash",
    action: "继续",
  },
  {
    id: "assets",
    title: "先认识两个朋友",
    mrBrown: "股票像坐过山车 — 可能涨很多也可能跌；债券像存储蓄罐 — 稳定但收益慢。大多数聪明的投资者会两个都用。",
    visual: "compare",
    concepts: [
      { term: "风险", emoji: "🎢", desc: "可能亏钱的程度" },
      { term: "收益", emoji: "📈", desc: "可能赚钱的程度" },
    ],
    action: "我懂了",
  },
  {
    id: "first-trade",
    title: "试试你的第一笔交易",
    mrBrown: "点下面的按钮，买入 10 股「智造先锋股票」。不用怕，这是模拟的 — 先感受一下什么叫「下单」。",
    visual: "trade",
    interactive: true,
    action: "确认买入 10 股",
  },
  {
    id: "time-skip",
    title: "时间快进！",
    mrBrown: "看！市场动了，你的组合发生了变化。涨还是跌？这就是市场 — 没有人能100%预测它，但你可以学会应对。",
    visual: "chart",
    action: "继续",
  },
  {
    id: "event-card",
    title: "你的第一张事件卡",
    mrBrown: "市场不是随机的 — 有新闻、政策和经济数据在影响它。每回合你都会收到一张事件卡，帮你理解发生了什么。",
    visual: "event",
    concepts: [
      { term: "利好", emoji: "🟢", desc: "对市场有正面影响的消息" },
      { term: "利空", emoji: "🔴", desc: "对市场有负面影响的消息" },
    ],
    action: "我知道了",
  },
  {
    id: "ready",
    title: "你的旅程开始了",
    mrBrown: "接下来的 10 个回合，你可以自由决策。每几回合我会给你一份行为分析报告，帮你发现自己的投资「习惯」。加油！🎯",
    visual: "launch",
    action: "进入沙盘",
  },
];

interface OnboardingFlowProps {
  userName: string;
  onComplete: () => void;
}

export function OnboardingFlow({ userName, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [tradeExecuted, setTradeExecuted] = useState(false);
  const current = STEPS[step];

  const handleNext = useCallback(async () => {
    if (step === 3 && !tradeExecuted) {
      setTradeExecuted(true);
      return;
    }

    if (step >= STEPS.length - 1) {
      try {
        await fetch("/api/auth/onboarding", { method: "POST" });
      } catch {}
      onComplete();
      return;
    }

    setStep((s) => s + 1);
  }, [step, tradeExecuted, onComplete]);

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink-900)]/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mx-4 w-full max-w-lg overflow-hidden rounded-3xl bg-[var(--surface)] shadow-2xl"
      >
        <div className="h-1 bg-[var(--ink-100)]">
          <motion.div
            className="h-full bg-[var(--brand)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <div className="px-6 pb-8 pt-6 sm:px-8">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--ink-400)]">
            Mr.Brown 的第一堂课 · {step + 1}/{STEPS.length}
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="font-display mt-4 text-2xl font-semibold text-[var(--ink-900)]">
                {current.title}
              </h2>

              <div className="mt-5 flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--amber-100)] text-lg">
                  🎓
                </div>
                <div className="rounded-2xl rounded-tl-md bg-[var(--ink-50)] px-4 py-3 text-sm leading-relaxed text-[var(--ink-700)]">
                  {current.mrBrown.replace("新同学", userName)}
                </div>
              </div>

              {current.concepts && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {current.concepts.map((c) => (
                    <div key={c.term} className="rounded-xl border border-[var(--ink-200)] px-4 py-3">
                      <span className="text-lg">{c.emoji}</span>
                      <p className="mt-1 text-sm font-semibold text-[var(--ink-800)]">{c.term}</p>
                      <p className="mt-0.5 text-xs text-[var(--ink-500)]">{c.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {current.id === "first-trade" && tradeExecuted && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-xl border border-[var(--down-200)] bg-[var(--down-50)] px-4 py-3"
                >
                  <p className="text-sm font-medium text-[var(--down-700)]">
                    交易成功！你现在持有 10 股「智造先锋股票」，现金减少了 ¥1,120。
                  </p>
                </motion.div>
              )}

              {current.id === "capital" && (
                <div className="mt-4 flex items-center gap-4 rounded-xl bg-[var(--amber-50)] px-5 py-4">
                  <span className="font-mono text-3xl font-bold text-[var(--amber-700)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ¥120,000
                  </span>
                  <span className="text-xs text-[var(--ink-500)]">初始资金</span>
                </div>
              )}

              {current.id === "time-skip" && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--up-50)] px-5 py-4">
                  <span className="font-mono text-2xl font-bold text-[var(--up-600)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ¥120,672
                  </span>
                  <span className="text-sm text-[var(--up-500)]">+0.56%</span>
                  <span className="text-xs text-[var(--ink-400)]">第 2 回合净值</span>
                </div>
              )}

              {current.id === "event-card" && (
                <div className="mt-4 rounded-xl border border-[var(--ink-200)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[var(--up-100)] px-2 py-0.5 text-xs font-medium text-[var(--up-600)]">利好</span>
                    <span className="text-sm font-medium text-[var(--ink-800)]">消费与科技订单共同回暖</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--ink-500)]">
                    企业补库存与居民消费恢复同步出现，成长资产的风险偏好上升。
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="text-sm text-[var(--ink-400)] hover:text-[var(--ink-600)]"
              >
                ← 上一步
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleNext}
              className="rounded-full bg-[var(--brand)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--amber-600)]"
            >
              {current.id === "first-trade" && !tradeExecuted ? "确认买入 10 股" : current.action}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
