"use client";

import { useEffect, useState } from "react";

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
    <section className="border-b border-white/8 bg-[#0d1324] text-white">
      <div className="page-shell flex items-center gap-3 py-2.5 sm:gap-4 sm:py-3">
        <div className="hidden shrink-0 xl:block">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#f08a38]">Market Pulse</p>
          <p className="mt-1 text-sm font-medium text-white/72">美股 AI / 科技观察池</p>
        </div>

        <div className="group relative min-w-0 flex-1 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-[#0d1324] via-[#0d1324]/85 to-transparent sm:w-12" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-[#0d1324] via-[#0d1324]/85 to-transparent sm:w-12" />

          <div
            className="stock-ticker-marquee group-hover:[animation-play-state:paused]"
            style={{ ["--ticker-duration" as string]: "28s" }}
          >
            {marqueeItems.map((item, index) => {
              const moveTone = getMarketMoveClasses(item.changePercent);

              return (
                <div
                  key={`${item.symbol}-${index}`}
                  className="flex min-w-[156px] items-center gap-2.5 border-r border-white/8 px-3 py-2.5 last:border-r-0 sm:min-w-[176px] sm:gap-3 sm:px-4 sm:py-3 md:min-w-[210px]"
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.28)] sm:h-8 sm:w-8 sm:text-[11px]"
                    style={{
                      background: `linear-gradient(135deg, ${item.accentColor} 0%, rgba(255,255,255,0.12) 120%)`,
                    }}
                  >
                    {item.monogram}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-white sm:text-sm">{item.symbol}</span>
                      <span className="truncate text-[11px] text-white/48 sm:text-xs">{item.name}</span>
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

        <div className="hidden shrink-0 items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/64 lg:flex">
          <span
            className={cn(
              "inline-flex h-2.5 w-2.5 rounded-full",
              payload.provider === "alltick"
                ? "bg-[#d43c33]"
                : payload.provider === "hybrid"
                  ? "bg-[#f08a38]"
                  : "bg-white/36",
            )}
          />
          <span>{payload.provider === "fallback" ? "教学观察池模式" : "10 分钟自动刷新"}</span>
        </div>
      </div>
    </section>
  );
}
