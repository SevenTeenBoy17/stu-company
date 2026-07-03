"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

import type { TickerTapePayload } from "@/lib/market-data";
import { MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import { cn, getMarketMoveClasses } from "@/lib/utils";

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value >= 100 ? 2 : 3,
    maximumFractionDigits: value >= 100 ? 2 : 3,
  });
}

export function StockTickerTape({ initialPayload }: { initialPayload: TickerTapePayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [paused, setPaused] = useState(false);
  const marqueeItems = [...payload.items, ...payload.items];

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/market/ticker-tape", {
          cache: "no-store",
        });
        const nextPayload = (await response.json()) as TickerTapePayload & { error?: string };

        if (!response.ok || nextPayload.error) {
          return;
        }

        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch {
        // 保留当前轮播内容，不因刷新失败而闪空。
      }
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, MARKET_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="border-b border-white/8 bg-bg-inverse text-white">
      <div className="page-shell flex items-center gap-3 py-2.5 sm:gap-4 sm:py-3">
        <div className="hidden shrink-0 xl:block">
          <p className="text-xs uppercase tracking-[0.28em] text-brand">Market Pulse</p>
          <p className="mt-1 text-sm font-medium text-white/72">美股 AI / 科技观察池</p>
        </div>

        <div
          className="group relative min-w-0 flex-1 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]"
          data-allow-overflow="true"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-bg-inverse via-bg-inverse/85 to-transparent sm:w-12" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-bg-inverse via-bg-inverse/85 to-transparent sm:w-12" />

          <div
            className={cn(
              "stock-ticker-marquee group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]",
              paused && "[animation-play-state:paused]",
            )}
            data-allow-overflow="true"
            style={{ ["--ticker-duration" as string]: "28s" }}
          >
            {marqueeItems.map((item, index) => {
              const moveTone = getMarketMoveClasses(item.changePercent);

              return (
                <div
                  key={`${item.symbol}-${index}`}
                  className="flex min-w-fit items-center gap-2.5 border-r border-white/8 px-3 py-2.5 last:border-r-0 sm:min-w-[176px] sm:gap-3 sm:px-4 sm:py-3 md:min-w-[210px]"
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-lg shadow-slate-950/25 sm:h-8 sm:w-8 sm:text-xs"
                    style={{
                      background: `linear-gradient(135deg, ${item.accentColor} 0%, color-mix(in srgb, ${item.accentColor} 18%, white) 120%)`,
                    }}
                  >
                    {item.monogram}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-white sm:text-sm">{item.symbol}</span>
                      <span className="text-xs text-white/70">{item.name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[13px] sm:gap-3 sm:text-sm">
                      <span className="font-medium text-white/88">{formatPrice(item.currentPrice)}</span>
                      <span className={cn("font-semibold", moveTone.darkText)}>
                        {item.changePercent >= 0 ? "+" : ""}
                        {item.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          aria-label={paused ? "播放行情滚动" : "暂停行情滚动"}
          title={paused ? "播放行情滚动" : "暂停行情滚动"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg-inverse"
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>

        <div
          className="hidden shrink-0 items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/64 lg:flex"
          aria-live="polite"
          aria-atomic="true"
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-2.5 w-2.5 rounded-full",
              payload.provider === "tsanghi" ||
              payload.provider === "itick" ||
              payload.provider === "alltick"
                ? "bg-[var(--info-400)]"
                : payload.provider === "hybrid"
                  ? "bg-brand"
                  : "bg-white/36",
            )}
          />
          <span>
            {payload.provider === "fallback"
              ? "教学观察池模式"
              : payload.provider === "tsanghi"
                ? "沧海真实日线收盘 · 仅供教学（非实时）"
                : payload.provider === "itick"
                ? "iTick · 10 分钟自动刷新"
                : payload.provider === "alltick"
                ? "AllTick · 10 分钟自动刷新"
                : "混合行情 · 10 分钟自动刷新"}
          </span>
        </div>
      </div>
    </section>
  );
}
