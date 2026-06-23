/**
 * 一次性真实冒烟：用真实 token 走完整 provider，确认真实日线 → 报价/K线 链路通畅。
 * 运行：TSANGHI_API_TOKEN=<token> npx tsx scripts/tsanghi-smoke.ts
 * （或先 export，再运行；读 .env.local 请自行注入环境变量。）
 */
import { fetchTsanghiMarketBoardSnapshot, fetchTsanghiWatchlistSnapshot } from "@/lib/tsanghi";

async function main() {
  const wl = await fetchTsanghiWatchlistSnapshot();
  console.log("== watchlist ==");
  console.log("provider:", wl.provider);
  console.log("note:", wl.note);
  console.log(
    "quotes:",
    JSON.stringify(
      Object.fromEntries(
        Object.entries(wl.quotes).map(([k, v]) => [
          k,
          { price: v?.currentPrice, chgPct: v?.changePercent?.toFixed?.(2) },
        ]),
      ),
      null,
      0,
    ),
  );

  const board = await fetchTsanghiMarketBoardSnapshot("NVDA");
  console.log("\n== NVDA board ==");
  console.log("provider:", board.provider);
  console.log("kline tail:", board.selectedKline?.slice(-5));
  console.log(
    "candles:",
    board.selectedCandles?.length,
    "first:",
    board.selectedCandles?.[0]?.time,
    "last:",
    board.selectedCandles?.at(-1)?.time,
  );
}

main().catch((e) => {
  console.error("smoke failed:", e);
  process.exit(1);
});
