"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { useFocusTrap } from "@/lib/use-focus-trap";

gsap.registerPlugin(useGSAP);

type StepId =
  | "welcome"
  | "capital"
  | "assets"
  | "first-trade"
  | "risk"
  | "event-card"
  | "ready";

interface OnboardingStep {
  id: StepId;
  title: string;
  concept: string;
  mrBrown: string;
  action: string;
  interactive?: "capital" | "trade" | "quiz" | "event";
  concepts?: Array<{ term: string; desc: string }>;
}

const STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "欢迎来到 Brown Zone",
    concept: "教育模拟",
    mrBrown:
      "我是 Mr.Brown，你的财商导师。今天我们把一间教室变成 12 回合经济沙盘：不用真钱，也不追求一夜暴富，只练习如何做出更稳的判断。",
    action: "开始第一步",
  },
  {
    id: "capital",
    title: "你获得一笔班级启动资金",
    concept: "本金",
    mrBrown:
      "本金就是你一开始能使用的资源。它不是用来一次性押上的筹码，而是要被分配到现金、储蓄、资产和机会里，帮助你穿过不同市场环境。",
    action: "设定目标",
    interactive: "capital",
  },
  {
    id: "assets",
    title: "认识两类基础资产",
    concept: "风险与收益",
    mrBrown:
      "收益越高，不确定性通常也越高。股票像速度快的赛车，债券像更稳的安全车；青少年第一次学习投资时，先理解它们的差别就足够了。",
    action: "我理解了",
    concepts: [
      { term: "股票", desc: "可能涨得快，也可能短期波动大。" },
      { term: "债券", desc: "通常更稳，适合观察现金流和防守。" },
    ],
  },
  {
    id: "first-trade",
    title: "完成第一笔模拟下单",
    concept: "下单",
    mrBrown:
      "下单就是把你的判断变成一条可执行指令。先试着买入少量模拟股票，重点不是赚多少，而是看清楚价格、数量和现金会怎样变化。",
    action: "确认买入 10 股",
    interactive: "trade",
  },
  {
    id: "risk",
    title: "市场会改变结果",
    concept: "波动",
    mrBrown:
      "波动指价格在一段时间内上下变化。一次上涨不代表永远正确，一次下跌也不代表彻底失败；真正重要的是你有没有留出应对变化的空间。",
    action: "揭晓结果",
    interactive: "quiz",
  },
  {
    id: "event-card",
    title: "读懂第一张金融事件卡",
    concept: "利好与利空",
    mrBrown:
      "市场不是凭空变化的。新闻、政策、行业竞争和情绪都会影响资产价格；事件卡会帮你把复杂信息拆成一句话、一个影响和一个行动提醒。",
    action: "进入最后一步",
    interactive: "event",
    concepts: [
      { term: "利好", desc: "对某类资产可能产生正面影响。" },
      { term: "利空", desc: "对某类资产可能产生压力或风险。" },
    ],
  },
  {
    id: "ready",
    title: "你的决策旅程开始了",
    concept: "复盘",
    mrBrown:
      "接下来你会在每个回合做选择、看结果、写下原因。复盘不是找借口，而是把一次次行动变成更清楚的判断规则。",
    action: "进入学生策略台",
  },
];

// Fixed teaching outcome for the prediction step. Deliberately a DOWN move so the
// onboarding does not anchor teens on "markets always go up", and framed against
// the learner's own guess so the predict→reveal loop actually closes.
const MARKET_REVEAL = { direction: "down" as const, netWorth: 119_460, changePct: -0.45 };

interface OnboardingFlowProps {
  userName: string;
  showUpgradeShortcut?: boolean;
  onComplete: () => void;
}

export function OnboardingFlow({ userName, showUpgradeShortcut = false, onComplete }: OnboardingFlowProps) {
  const onboardingRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [tradeExecuted, setTradeExecuted] = useState(false);
  const [targetGuess, setTargetGuess] = useState(150_000);
  const [marketGuess, setMarketGuess] = useState<"up" | "down" | null>(null);
  const [marketRevealed, setMarketRevealed] = useState(false);
  const [aiTextByStep, setAiTextByStep] = useState<Record<string, string>>({});
  const [aiProviderByStep, setAiProviderByStep] = useState<Record<string, "remote" | "fallback">>({});
  const [canUsePersonalAi, setCanUsePersonalAi] = useState<boolean | null>(null);
  const current = STEPS[step];
  const personalizeFallback = useCallback(
    (text: string) => text.replace(String.fromCodePoint(0x65b0, 0x540c, 0x5b66), userName),
    [userName],
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { canUsePersonalAiAssessment?: boolean } | null) => {
        if (!cancelled) setCanUsePersonalAi(Boolean(data?.canUsePersonalAiAssessment));
      })
      .catch(() => {
        if (!cancelled) setCanUsePersonalAi(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (aiTextByStep[current.id]) return;
    if (canUsePersonalAi === null) return;

    if (canUsePersonalAi !== true) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setAiTextByStep((value) => ({
          ...value,
          [current.id]: personalizeFallback(current.mrBrown),
        }));
        setAiProviderByStep((value) => ({ ...value, [current.id]: "fallback" }));
      });
      return () => {
        cancelled = true;
      };
    }

    fetch("/api/ai/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stepId: current.id,
        stepTitle: current.title,
        concept: current.concept,
        fallbackText: current.mrBrown,
        progressLabel: `${step + 1}/${STEPS.length}`,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("onboarding_ai_unavailable");
        return (await response.json()) as { text?: string; provider?: "remote" | "fallback" };
      })
      .then((payload) => {
        if (cancelled || !payload.text) return;
        setAiTextByStep((value) => ({ ...value, [current.id]: payload.text ?? "" }));
        setAiProviderByStep((value) => ({
          ...value,
          [current.id]: payload.provider ?? "fallback",
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setAiTextByStep((value) => ({
          ...value,
          [current.id]: current.mrBrown.replace("新同学", userName),
        }));
        setAiProviderByStep((value) => ({ ...value, [current.id]: "fallback" }));
      });

    return () => {
      cancelled = true;
    };
  }, [aiTextByStep, canUsePersonalAi, current, personalizeFallback, step, userName]);

  const completeOnboarding = useCallback(async () => {
    try {
      await fetch("/api/auth/onboarding", { method: "POST" });
    } catch {
      // Do not trap the student in onboarding if the completion write is delayed.
    }
    onComplete();
  }, [onComplete]);

  useFocusTrap(true, panelRef, () => {
    void completeOnboarding();
  });

  useEffect(() => {
    const root = onboardingRef.current;
    const parent = root?.parentElement;
    if (!root || !parent) return;

    const siblings = Array.from(parent.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== root);
    const previous = siblings.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.inert,
    }));

    siblings.forEach((element) => {
      element.setAttribute("aria-hidden", "true");
      element.inert = true;
    });

    return () => {
      previous.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }
        element.inert = inert;
      });
    };
  }, []);

  const jumpToUpgrade = useCallback(async () => {
    await completeOnboarding();
    window.setTimeout(() => {
      document.getElementById("guest-upgrade-checkout")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }, [completeOnboarding]);

  const handleNext = useCallback(async () => {
    if (current.id === "first-trade" && !tradeExecuted) {
      setTradeExecuted(true);
      return;
    }

    if (current.id === "risk" && !marketRevealed) {
      setMarketRevealed(true);
      return;
    }

    if (step >= STEPS.length - 1) {
      await completeOnboarding();
      return;
    }

    setStep((value) => value + 1);
  }, [completeOnboarding, current.id, marketRevealed, step, tradeExecuted]);

  const progress = ((step + 1) / STEPS.length) * 100;
  const aiText = aiTextByStep[current.id] ?? current.mrBrown.replace("新同学", userName);
  const aiProvider = aiProviderByStep[current.id];

  useGSAP(
    () => {
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const panel = onboardingRef.current?.querySelector("[data-onboarding-panel]");
      const stepPanel = onboardingRef.current?.querySelector("[data-onboarding-step]");
      const progressBar = onboardingRef.current?.querySelector("[data-onboarding-progress]");
      const eventPanels = gsap.utils.toArray<HTMLElement>("[data-onboarding-event]");

      if (reducedMotion) {
        gsap.set([panel, stepPanel, progressBar, ...eventPanels].filter(Boolean), {
          autoAlpha: 1,
          clearProps: "transform,opacity,visibility",
        });
        return;
      }

      if (panel) {
        gsap.fromTo(
          panel,
          { autoAlpha: 0, scale: 0.96, y: 14 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 0.34, ease: "power3.out", overwrite: "auto" },
        );
      }

      if (stepPanel) {
        gsap.fromTo(
          stepPanel,
          { autoAlpha: 0, x: 18 },
          { autoAlpha: 1, x: 0, duration: 0.28, ease: "power3.out", overwrite: "auto" },
        );
      }

      if (progressBar) {
        gsap.fromTo(
          progressBar,
          { scaleX: 0.75 },
          { scaleX: 1, duration: 0.36, ease: "power2.out", overwrite: "auto" },
        );
      }

      if (eventPanels.length) {
        gsap.fromTo(
          eventPanels,
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: 0.26, ease: "power3.out", stagger: 0.04, overwrite: "auto" },
        );
      }
    },
    { scope: onboardingRef, dependencies: [step, tradeExecuted, marketRevealed, progress], revertOnUpdate: true },
  );

  return (
    <div ref={onboardingRef} className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink-900)]/80 p-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        data-onboarding-panel
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-onboarding-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-[var(--surface)] shadow-2xl"
      >
        <div className="h-1 bg-[var(--ink-100)]">
          <div
            data-onboarding-progress
            className="h-full bg-[var(--brand)]"
            style={{ width: `${progress}%`, transformOrigin: "left center" }}
          />
        </div>

        <div className="grid gap-0 md:grid-cols-[0.95fr_1.35fr]">
          <aside className="bg-[var(--ink-900)] px-6 py-7 text-white md:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--brand)]">
              Brown Zone 新手村
            </p>
            <h2 id="student-onboarding-title" className="mt-4 text-2xl font-semibold leading-tight">{current.title}</h2>
            <p className="mt-3 text-sm leading-7 text-white/68">
              每一步只学习一个概念，先做轻量选择，再进入正式沙盘。
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/8 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/70">本步概念</p>
              <p className="mt-2 text-xl font-semibold">{current.concept}</p>
              <p className="mt-2 text-xs leading-6 text-white/58">进度 {step + 1}/{STEPS.length}</p>
            </div>
          </aside>

          <main className="px-6 pb-7 pt-6 sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-400)]">
                Mr.Brown AI 教学
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showUpgradeShortcut ? (
                  <button
                    type="button"
                    onClick={jumpToUpgrade}
                    className="rounded-full border border-[var(--amber-200)] bg-[var(--amber-50)] px-3 py-1.5 text-xs font-semibold text-[var(--amber-700)] transition hover:bg-[var(--amber-100)]"
                  >
                    先开通完整 AI
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={completeOnboarding}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--ink-500)] transition hover:bg-[var(--ink-50)] hover:text-[var(--ink-700)]"
                >
                  跳过引导
                </button>
              </div>
            </div>

              <section
                key={current.id}
                data-onboarding-step
              >
                <div className="mt-5 rounded-3xl border border-[var(--ink-100)] bg-[var(--ink-50)] p-5">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--amber-100)] text-sm font-bold text-[var(--amber-700)]">
                      AI
                    </div>
                    <div>
                      <p className="text-sm leading-7 text-[var(--ink-700)]">{aiText}</p>
                      <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-400)]">
                        {aiProvider === "remote" ? "AI 已参与生成" : "本地教学脚本兜底"}
                      </p>
                    </div>
                  </div>
                </div>

                {current.concepts && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {current.concepts.map((concept) => (
                      <div
                        key={concept.term}
                        className="rounded-2xl border border-[var(--ink-200)] bg-white px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-[var(--ink-900)]">{concept.term}</p>
                        <p className="mt-1 text-xs leading-6 text-[var(--ink-500)]">{concept.desc}</p>
                      </div>
                    ))}
                  </div>
                )}

                {current.interactive === "capital" && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-[var(--amber-50)] px-5 py-4">
                      <p className="text-xs font-medium text-[var(--ink-500)]">初始模拟本金</p>
                      <p className="mt-1 font-mono text-3xl font-bold text-[var(--amber-700)]">
                        ￥120,000
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--ink-200)] px-4 py-3">
                      <p className="text-xs text-[var(--ink-500)]">你希望 12 回合后净值到哪里？</p>
                      <input
                        type="range"
                        min={80_000}
                        max={200_000}
                        step={5_000}
                        value={targetGuess}
                        onChange={(event) => setTargetGuess(Number(event.target.value))}
                        className="mt-3 w-full accent-[var(--brand)]"
                      />
                      <p className="mt-2 text-center font-mono text-lg font-bold text-[var(--amber-700)]">
                        ￥{targetGuess.toLocaleString("zh-CN")}
                      </p>
                    </div>
                  </div>
                )}

                {current.interactive === "trade" && tradeExecuted && (
                  <div
                    data-onboarding-event
                    className="mt-4 rounded-2xl border border-[var(--up-200)] bg-[var(--up-50)] px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-[var(--up-700)]">
                      模拟交易成功：买入 10 股“智造先锋股票”，现金减少 ￥1,120。
                    </p>
                    <p className="mt-1 text-xs leading-6 text-[var(--ink-500)]">
                      这不是投资建议，只是帮助你看懂下单后资产和现金如何变化。
                    </p>
                  </div>
                )}

                {current.interactive === "quiz" && !marketRevealed && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {(["up", "down"] as const).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setMarketGuess(choice)}
                        className={`rounded-2xl border-2 px-4 py-4 text-left transition-colors ${
                          marketGuess === choice
                            ? "border-[var(--brand)] bg-[var(--amber-50)]"
                            : "border-[var(--ink-200)] bg-white"
                        }`}
                      >
                        <span className="text-sm font-semibold text-[var(--ink-900)]">
                          {choice === "up" ? "我猜会上涨" : "我猜会下跌"}
                        </span>
                        <p className="mt-1 text-xs leading-5 text-[var(--ink-500)]">
                          先形成判断，再看结果。
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {current.interactive === "quiz" && marketRevealed && (
                  <div
                    data-onboarding-event
                    className="mt-4 rounded-2xl bg-[var(--down-50)] px-5 py-4"
                  >
                    <p className="font-mono text-2xl font-bold text-[var(--down-700)]">
                      ￥{MARKET_REVEAL.netWorth.toLocaleString("zh-CN")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--down-600)]">
                      {MARKET_REVEAL.changePct}%
                    </p>
                    <p className="mt-2 text-xs leading-6 text-[var(--ink-500)]">
                      {marketGuess === MARKET_REVEAL.direction
                        ? "这次市场确实下跌了，你猜对了方向。但请记住：猜对方向不代表你的理由一定对 —— 真正的高手复盘看的是逻辑，而不是这一次的输赢。"
                        : marketGuess === "up"
                          ? "这次和你猜的相反，市场下跌了。短期涨跌很难预测，猜错方向不代表你失败 —— 重要的是你有没有为「万一看错」留出应对空间。"
                          : "结果揭晓了。市场短期充满不确定性，方向谁都说不准；与其押对一次，不如练习在任何方向下都能稳住组合。"}
                    </p>
                  </div>
                )}

                {current.interactive === "event" && (
                  <div className="mt-4 rounded-2xl border border-[var(--ink-200)] bg-white px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--up-100)] px-2.5 py-1 text-xs font-semibold text-[var(--up-700)]">
                        利好
                      </span>
                      <span className="text-sm font-semibold text-[var(--ink-900)]">
                        消费与科技订单回暖
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-[var(--ink-500)]">
                      企业补库存与居民消费恢复同步出现，成长资产的风险偏好上升。先观察，不要一次性满仓。
                    </p>
                  </div>
                )}
              </section>

            <div className="mt-6 flex items-center justify-between gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--ink-500)] transition hover:bg-[var(--ink-50)] hover:text-[var(--ink-700)]"
                >
                  上一步
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={handleNext}
                className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-[var(--amber-600)]"
              >
                {current.interactive === "trade" && !tradeExecuted ? "确认买入 10 股" : current.action}
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
