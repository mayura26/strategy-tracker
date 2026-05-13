import {
  alignDailyPnL,
  filterAlignedDays,
  summarizeDistribution,
} from "@/lib/comparison-analytics";
import { assertApprox, assertEqual } from "@/tests/assert";

const distribution = summarizeDistribution([
  -500, -100, 0, 100, 120, 140, 1000,
]);

assertEqual(distribution.count, 7, "distribution count");
assertEqual(distribution.median, 100, "distribution median");
assertApprox(distribution.q1, -50, "distribution q1");
assertApprox(distribution.q3, 130, "distribution q3");
assertEqual(distribution.outlierCount, 2, "distribution outliers");
assertEqual(distribution.lowerWhisker, -100, "lower whisker");
assertEqual(distribution.upperWhisker, 140, "upper whisker");

const goldenDays = [
  day("2026-01-01", 100, 2),
  day("2026-01-02", -50, 1),
  day("2026-01-03", -25, 1),
  day("2026-01-04", 200, 3),
];
const candidateDays = [
  day("2026-01-01", 125, 2),
  day("2026-01-02", -100, 2),
  day("2026-01-03", 75, 1),
  day("2026-01-05", 300, 2),
];
const aligned = alignDailyPnL(goldenDays, candidateDays);

assertEqual(aligned.length, 5, "aligned date union");
assertEqual(aligned[0].delta, 25, "aligned delta");
assertEqual(aligned.at(-1)?.goldenPnl, 0, "missing golden day");
assertEqual(aligned.at(-1)?.candidatePnl, 300, "candidate-only day");

assertEqual(
  filterAlignedDays(aligned, {
    bucket: "candidate-wins",
    hideSimilar: false,
    similarThreshold: 50,
  }).length,
  3,
  "candidate wins",
);
assertEqual(
  filterAlignedDays(aligned, {
    bucket: "golden-wins",
    hideSimilar: false,
    similarThreshold: 50,
  }).length,
  2,
  "golden wins",
);
assertEqual(
  filterAlignedDays(aligned, {
    bucket: "both-loss",
    hideSimilar: false,
    similarThreshold: 50,
  }).length,
  1,
  "both loss",
);
assertEqual(
  filterAlignedDays(aligned, {
    bucket: "disagreement",
    hideSimilar: false,
    similarThreshold: 50,
  }).length,
  1,
  "disagreement",
);
assertEqual(
  filterAlignedDays(aligned, {
    bucket: "all",
    hideSimilar: true,
    similarThreshold: 50,
  }).length,
  4,
  "hide similar threshold",
);

console.log("Comparison analytics tests passed.");

function day(tradingDate: string, netProfit: number, tradeCount: number) {
  return {
    tradingDate,
    tradeCount,
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
