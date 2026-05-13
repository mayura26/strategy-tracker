import type { DailyRunMetric } from "@/lib/analytics";
import type { MarketBar } from "@/lib/db/repository";
import { joinMarketPerformanceDays } from "@/lib/market-performance";
import { assertEqual, assertOk } from "@/tests/assert";

const joined = joinMarketPerformanceDays(
  [day("2026-01-03", 300), day("2026-01-01", -100), day("2026-01-02", 50)],
  [
    bar("2026-01-02", {
      open: 100,
      high: 110,
      low: 95,
      close: 108,
    }),
    bar("2026-01-03", {
      open: null,
      high: 112,
      low: 104,
      close: 106,
    }),
  ],
);

assertEqual(joined.length, 2, "joined market days omit missing bars");
assertEqual(joined[0].tradingDate, "2026-01-02", "joined days sort asc");
assertOk(joined[0].hasCompleteOhlc, "complete OHLC is flagged");
assertOk(!joined[1].hasCompleteOhlc, "partial OHLC is flagged");
assertEqual(joined[1].netProfit, 300, "daily pnl is preserved");

console.log("Market performance join tests passed.");

function day(tradingDate: string, netProfit: number): DailyRunMetric {
  return {
    tradingDate,
    tradeCount: 1,
    netProfit,
    cumulativeNetProfit: netProfit,
    winCount: netProfit > 0 ? 1 : 0,
    lossCount: netProfit < 0 ? 1 : 0,
    maxDrawdown: Math.min(netProfit, 0),
    bestTrade: netProfit,
    worstTrade: netProfit,
    avgMae: null,
    avgMfe: null,
  };
}

function bar(
  tradingDate: string,
  values: Pick<MarketBar, "open" | "high" | "low" | "close">,
): MarketBar {
  return {
    tradingDate,
    open: values.open,
    high: values.high,
    low: values.low,
    close: values.close,
    volume: null,
    trueRange: null,
    atr14: 14,
    range:
      values.high !== null && values.low !== null
        ? values.high - values.low
        : null,
    gap: null,
    sourceStatus: "ok",
  };
}
