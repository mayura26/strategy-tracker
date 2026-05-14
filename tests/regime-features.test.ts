import type { DailyRunMetric } from "@/lib/analytics";
import type { AnalysisSettings, MarketBar } from "@/lib/db/repository";
import {
  buildPredictiveRegimeDays,
  calculateEmaValues,
  calculateRsiValues,
  classifyEmaCross,
  classifyEmaStack,
  summarizePredictiveThreshold,
} from "@/lib/regime-features";
import { assertApprox, assertEqual } from "@/tests/assert";

const settings: AnalysisSettings = {
  emaFastPeriod: 2,
  emaMidPeriod: 3,
  emaSlowPeriod: 5,
  rsiPeriod: 3,
  updatedAt: null,
};

const ema = calculateEmaValues([10, 12, 14], 3);
assertEqual(ema[0], 10, "EMA seeds from first close");
assertEqual(ema[1], 11, "EMA applies multiplier");
assertEqual(ema[2], 12.5, "EMA continues smoothing");

const rsi = calculateRsiValues([10, 11, 12, 13, 12], 3);
assertEqual(rsi[2], null, "RSI waits for enough changes");
assertEqual(rsi[3], 100, "RSI handles no losses");
assertApprox(rsi[4] ?? 0, 66.6667, "RSI Wilder smoothing", 0.0001);

assertEqual(classifyEmaStack(3, 2, 1), "bullish", "bullish EMA stack");
assertEqual(classifyEmaStack(1, 2, 3), "bearish", "bearish EMA stack");
assertEqual(classifyEmaStack(2, 3, 1), "mixed", "mixed EMA stack");
assertEqual(classifyEmaCross(1, 2, 3, 2), "cross-up", "EMA cross up");
assertEqual(classifyEmaCross(3, 2, 1, 2), "cross-down", "EMA cross down");

const bars = [
  bar("2026-01-01", 10, 1),
  bar("2026-01-02", 11, 2),
  bar("2026-01-03", 12, 3),
  bar("2026-01-04", 13, 4),
  bar("2026-01-05", 12, 5),
];
const days = [
  day("2026-01-03", 100),
  day("2026-01-04", -50),
  day("2026-01-05", 200),
];
const predictiveDays = buildPredictiveRegimeDays(days, bars, settings);

assertEqual(
  predictiveDays[0].previousTradingDate,
  "2026-01-02",
  "prediction uses previous market day",
);
assertEqual(
  predictiveDays[0].previousClose,
  11,
  "prediction does not use same-day close",
);
assertEqual(
  predictiveDays[2].previousRsi,
  100,
  "previous RSI is available after warmup",
);

const thresholdSummary = summarizePredictiveThreshold(
  predictiveDays,
  "previousAtr14",
  3,
);

assertEqual(thresholdSummary.above.count, 2, "ATR above bucket");
assertEqual(thresholdSummary.below.count, 1, "ATR below bucket");
assertEqual(thresholdSummary.above.totalPnl, 150, "ATR bucket total PnL");

console.log("Regime feature tests passed.");

function bar(tradingDate: string, close: number, atr14: number): MarketBar {
  return {
    tradingDate,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100,
    trueRange: 2,
    atr14,
    range: 2,
    gap: 0.5,
    sourceStatus: "ok",
  };
}

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
