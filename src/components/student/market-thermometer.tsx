"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Activity, ArrowRight, ThermometerSun } from "lucide-react";

import { Disclosure } from "@/components/shared/disclosure";
import type { MarketTemperatureFactor, MarketTemperaturePayload } from "@/lib/market-sentiment";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const levelCopy: Record<MarketTemperaturePayload["level"], { title: string; tone: string; bar: string; chip: string }> = {
  cold: {
    title: "冷静观察区",
    tone: "text-sky-100",
    bar: "from-sky-300 via-emerald-300 to-amber-200",
    chip: "border-sky-200/25 bg-sky-200/10 text-sky-50",
  },
  cooling: {
    title: "降温修复区",
    tone: "text-emerald-100",
    bar: "from-emerald-300 via-teal-200 to-amber-200",
    chip: "border-emerald-200/25 bg-emerald-200/10 text-emerald-50",
  },
  balanced: {
    title: "均衡校准区",
    tone: "text-amber-100",
    bar: "from-emerald-300 via-amber-200 to-orange-300",
    chip: "border-amber-200/25 bg-amber-200/10 text-amber-50",
  },
  warm: {
    title: "偏热验证区",
    tone: "text-orange-100",
    bar: "from-amber-300 via-orange-300 to-rose-300",
    chip: "border-orange-200/25 bg-orange-200/10 text-orange-50",
  },
  hot: {
    title: "过热刹车区",
    tone: "text-rose-100",
    bar: "from-orange-300 via-rose-300 to-red-300",
    chip: "border-rose-200/25 bg-rose-200/10 text-rose-50",
  },
};

const factorTone: Record<MarketTemperatureFactor["tone"], string> = {
  positive: "bg-rose-100 text-rose-800",
  neutral: "bg-white/14 text-white",
  negative: "bg-emerald-100 text-emerald-800",
};

export function MarketThermometer({
  payload,
  className,
}: {
  payload: MarketTemperaturePayload;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tone = levelCopy[payload.level];

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from("[data-temp-reveal]", {
        y: 14,
        opacity: 0,
        duration: 0.48,
        ease: "power3.out",
        stagger: 0.055,
      });
      gsap.fromTo(
        "[data-market-temp-fill]",
        { scaleX: 0, transformOrigin: "left center" },
        { scaleX: 1, duration: 0.8, ease: "power3.out", delay: 0.12 },
      );
    },
    { scope: rootRef },
  );

  return (
    <article
      ref={rootRef}
      data-testid="market-thermometer"
      className={cn(
        "relative min-h-full overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.25)] sm:p-6",
        className,
      )}
    >
      <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-orange-400/20 blur-3xl" />
      <div className="absolute -bottom-20 left-1/4 h-44 w-56 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="relative z-10">
        <div data-temp-reveal className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="bz-eyebrow-inverse">Market Thermometer</p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">市场温度计</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/84">{payload.roundLabel}</p>
          </div>
          <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold", tone.chip)}>
            <ThermometerSun className="h-4 w-4" />
            {payload.label}
          </span>
        </div>

        <div data-temp-reveal className="mt-6 grid gap-4 lg:grid-cols-[minmax(240px,0.72fr)_minmax(0,1.28fr)]">
          <div className="min-h-[252px] rounded-[1.55rem] border border-white/10 bg-white/[0.06] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white/78">情绪温度</p>
                {/* .bz-hero-stat carries a LIGHT amber-50 chip bg — on this dark panel it
                    makes the light tone.tone text fail AA, so drop the chip and keep the
                    hero-num scale (light tone on near-black is AA-compliant). */}
                <p className={cn("text-hero-num tabular-nums mt-1 tracking-tight", tone.tone)}>{payload.score}</p>
              </div>
              <p className="max-w-28 text-right text-base font-bold leading-6 text-white">{tone.title}</p>
            </div>
            <div className="mt-6 h-4 overflow-hidden rounded-full bg-white/10">
              <div
                data-market-temp-fill
                className={cn("h-full rounded-full bg-gradient-to-r", tone.bar)}
                style={{ width: `${payload.score}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/82">
              <span>冷静</span>
              <span>均衡</span>
              <span>过热</span>
            </div>
          </div>

          <div className="min-h-[252px] rounded-[1.55rem] border border-white/10 bg-white/[0.05] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-fg-strong">
                <Activity className="h-3.5 w-3.5 text-orange-500" />
                {payload.eventSignal}
              </span>
              <span className="text-base font-bold text-white">{payload.eventTitle}</span>
            </div>
            <p className="mt-4 text-base font-semibold leading-8 text-white/86">{payload.summary}</p>
            {/* v2 信息收敛：逆向提示默认收起（深底面板 → 覆写 Disclosure 的浅色文字类保证对比度） */}
            <Disclosure
              summary="逆向提示"
              className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3"
              summaryClassName="text-white hover:text-orange-200"
              panelClassName="text-white/86 leading-7"
            >
              {payload.contrarianHint}
            </Disclosure>
          </div>
        </div>

        <div data-temp-reveal className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {payload.factors.map((factor) => (
            <div key={factor.label} className="min-h-[92px] rounded-[1.18rem] border border-white/10 bg-white/[0.06] px-4 py-4">
              <p className="text-sm font-bold text-white/78">{factor.label}</p>
              <span className={cn("mt-3 inline-flex rounded-full px-3 py-1.5 text-sm font-semibold", factorTone[factor.tone])}>
                {factor.value}
              </span>
            </div>
          ))}
        </div>

        {/* v2 信息收敛：底部方法论解说句已删（审计项），只保留行动入口 */}
        <div data-temp-reveal className="mt-5 flex sm:justify-end">
          <Link
            data-motion-button
            href="/student/market"
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full sm:w-auto bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 px-6 text-base font-bold !text-white shadow-[0_18px_44px_rgba(240,138,56,0.30)] transition hover:-translate-y-0.5 hover:!text-white hover:shadow-[0_22px_54px_rgba(240,138,56,0.38)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-200"
          >
            进入市场雷达继续拆解
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
