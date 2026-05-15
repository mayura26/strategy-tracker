import {
  alignDailyPnL,
  buildHistogram,
  countSingleRunDays,
  discoverModeSwitchRules,
  evaluateModeSwitchRule,
  evaluateSwitchCondition,
  filterAlignedDays,
  sortAlignedDaysNewestFirst,
  summarizeDistribution,
  summarizeOutcomes,
  summarizeOutperformance,
} from "@/lib/comparison-analytics";
import type {
  AnalysisSettings,
  MarketBar,
  MarketSessionFeature,
} from "@/lib/db/repository";
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

const histogram = buildHistogram([-120, -25, 0, 35, 110, 220], 6);
assertEqual(histogram[0].start, -200, "histogram nice lower bound");
assertEqual(histogram.at(-1)?.end, 300, "histogram nice upper bound");
assertEqual(
  histogram.reduce((sum, bin) => sum + bin.count, 0),
  6,
  "histogram counts all values",
);

const outcomes = summarizeOutcomes([-100, 0, 50, 150, -25]);
assertEqual(outcomes.greenDays, 2, "outcome green days");
assertEqual(outcomes.redDays, 2, "outcome red days");
assertEqual(outcomes.flatDays, 1, "outcome flat days");
assertApprox(outcomes.greenRate, 0.4, "outcome green rate");
assertEqual(outcomes.bestDay, 150, "outcome best day");
assertEqual(outcomes.worstDay, -100, "outcome worst day");

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
const overlapAligned = alignDailyPnL(goldenDays, candidateDays, "overlap");

assertEqual(aligned.length, 5, "aligned date union");
assertEqual(aligned[0].delta, 25, "aligned delta");
assertEqual(aligned.at(-1)?.goldenPnl, 0, "missing golden day");
assertEqual(aligned.at(-1)?.candidatePnl, 300, "candidate-only day");
assertEqual(overlapAligned.length, 3, "aligned overlap date intersection");
assertEqual(
  overlapAligned.at(-1)?.tradingDate,
  "2026-01-03",
  "overlap excludes single-run dates",
);
assertEqual(countSingleRunDays(aligned, "golden"), 1, "golden-only day count");
assertEqual(
  countSingleRunDays(aligned, "candidate"),
  1,
  "candidate-only day count",
);
assertEqual(
  sortAlignedDaysNewestFirst(overlapAligned)[0].tradingDate,
  "2026-01-03",
  "newest-first aligned days",
);

const outperformance = summarizeOutperformance(aligned, 100);

assertEqual(outperformance.candidateBeats, 3, "candidate outperforms days");
assertEqual(outperformance.goldenBeats, 2, "golden outperforms days");
assertEqual(outperformance.candidateThresholdBeats, 2, "candidate excess days");
assertEqual(outperformance.goldenThresholdBeats, 1, "golden excess days");
assertEqual(outperformance.biggestCandidateBeat, 300, "candidate biggest beat");
assertEqual(outperformance.biggestGoldenBeat, 200, "golden biggest beat");

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

const switchSettings: AnalysisSettings = {
  atrPeriod: 2,
  emaCrossLookbackDays: 2,
  emaFastPeriod: 2,
  emaMidPeriod: 3,
  emaSlowPeriod: 5,
  rsiLowerBand: 30,
  rsiPeriod: 2,
  rsiUpperBand: 70,
  updatedAt: null,
};
const switchEvaluation = evaluateModeSwitchRule({
  marketBars: [
    bar("2026-02-01", 10),
    bar("2026-02-02", 11),
    bar("2026-02-03", 12),
    bar("2026-02-04", 11),
    bar("2026-02-05", 10),
  ],
  modeADays: [
    day("2026-02-04", 400, 2),
    day("2026-02-05", -200, 2),
    day("2026-02-06", -100, 1),
    day("2026-02-07", 999, 1),
  ],
  modeBDays: [
    day("2026-02-04", -50, 1),
    day("2026-02-05", 150, 1),
    day("2026-02-06", 50, 1),
  ],
  rule: {
    operator: "gt",
    threshold: 70,
  },
  settings: switchSettings,
});

assertEqual(
  evaluateSwitchCondition(70, { operator: "gt", threshold: 70 }),
  false,
  "strict greater switch condition",
);
assertEqual(
  evaluateSwitchCondition(70, { operator: "gte", threshold: 70 }),
  true,
  "inclusive greater switch condition",
);
assertEqual(switchEvaluation.days.length, 3, "switch overlap with RSI signal");
assertEqual(
  switchEvaluation.summary.comparedOverlapDays,
  3,
  "switch excludes non-overlap dates",
);
assertEqual(
  switchEvaluation.days[0].selectedMode,
  "mode-a",
  "RSI threshold true selects mode A",
);
assertEqual(
  switchEvaluation.days[1].selectedMode,
  "mode-b",
  "RSI threshold false selects mode B",
);
assertEqual(
  switchEvaluation.days[1].switchedPnl,
  150,
  "non-selected mode contributes zero by using only selected mode PnL",
);
assertEqual(switchEvaluation.summary.totalPnl, 600, "switch total PnL");
assertEqual(switchEvaluation.summary.modeADays, 1, "mode A routed days");
assertEqual(switchEvaluation.summary.modeBDays, 2, "mode B routed days");
assertEqual(switchEvaluation.summary.cashDays, 0, "cash routed days default");
assertEqual(
  switchEvaluation.summary.avoidedLossModeA,
  2,
  "mode A losses avoided while mode B selected",
);
assertEqual(
  switchEvaluation.summary.avoidedLossModeB,
  1,
  "mode B loss avoided while mode A selected",
);
assertEqual(switchEvaluation.summary.alwaysA.totalPnl, 100, "always A PnL");
assertEqual(switchEvaluation.summary.alwaysB.totalPnl, 150, "always B PnL");

const openingRangeSwitch = evaluateModeSwitchRule({
  marketBars: [
    bar("2026-02-01", 10),
    bar("2026-02-02", 11),
    bar("2026-02-03", 12),
  ],
  marketSessionFeatures: [
    sessionFeature("2026-02-02", 0.003),
    sessionFeature("2026-02-03", 0.009),
  ],
  modeADays: [day("2026-02-02", -100, 1), day("2026-02-03", 250, 1)],
  modeBDays: [day("2026-02-02", 150, 1), day("2026-02-03", -50, 1)],
  rule: {
    feature: "opening-range-5-pct",
    operator: "gte",
    threshold: 0.005,
  },
  settings: switchSettings,
});

assertEqual(
  openingRangeSwitch.days[0].selectedMode,
  "mode-b",
  "low opening range selects mode B",
);
assertEqual(
  openingRangeSwitch.days[1].selectedMode,
  "mode-a",
  "high opening range selects mode A",
);
assertEqual(
  openingRangeSwitch.summary.totalPnl,
  400,
  "opening range switch PnL",
);

const cashSwitch = evaluateModeSwitchRule({
  marketBars: [
    bar("2026-04-01", 10),
    bar("2026-04-02", 11),
    bar("2026-04-03", 12),
    bar("2026-04-04", 13),
  ],
  modeADays: [day("2026-04-04", 300, 1)],
  modeBDays: [day("2026-04-04", -500, 1)],
  rule: {
    falseRoute: "cash",
    operator: "lt",
    threshold: 10,
  },
  settings: switchSettings,
});

assertEqual(cashSwitch.days[0].selectedMode, "cash", "false route can be cash");
assertEqual(cashSwitch.days[0].switchedPnl, 0, "cash route has zero PnL");
assertEqual(cashSwitch.summary.cashDays, 1, "cash routed day counted");

const discoveredSwitches = discoverModeSwitchRules({
  marketBars: [
    bar("2026-03-01", 10),
    bar("2026-03-02", 11),
    bar("2026-03-03", 12),
    bar("2026-03-04", 13),
    bar("2026-03-05", 12),
    bar("2026-03-06", 11),
    bar("2026-03-07", 10),
    bar("2026-03-08", 11),
  ],
  minDays: 3,
  modeADays: [
    day("2026-03-04", 300, 1),
    day("2026-03-05", 250, 1),
    day("2026-03-06", -200, 1),
    day("2026-03-07", -150, 1),
    day("2026-03-08", 200, 1),
  ],
  modeBDays: [
    day("2026-03-04", -100, 1),
    day("2026-03-05", -50, 1),
    day("2026-03-06", 200, 1),
    day("2026-03-07", 150, 1),
    day("2026-03-08", -80, 1),
  ],
  settings: switchSettings,
  thresholds: [50, 70],
});

assertEqual(discoveredSwitches.length > 0, true, "switch candidates found");
assertEqual(
  discoveredSwitches[0].improvementVsBestAlways > 0,
  true,
  "top switch candidate improves on best always-run mode",
);
assertEqual(
  discoveredSwitches[0].evaluation.summary.modeADays > 0,
  true,
  "top switch candidate uses mode A",
);
assertEqual(
  discoveredSwitches[0].evaluation.summary.modeBDays > 0,
  true,
  "top switch candidate uses mode B",
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

function bar(tradingDate: string, close: number): MarketBar {
  return {
    atr14: 2,
    close,
    gap: 0,
    high: close + 1,
    low: close - 1,
    open: close - 0.25,
    range: 2,
    sourceStatus: "ok",
    tradingDate,
    trueRange: 2,
    volume: 100,
  };
}

function sessionFeature(
  tradingDate: string,
  openingRange5Pct: number,
): MarketSessionFeature {
  return {
    tradingDate,
    openingRange5: openingRange5Pct * 20_000,
    openingRange5Pct,
    openingRange10: openingRange5Pct * 22_000,
    openingRange10Pct: openingRange5Pct * 1.1,
    openingRange15: openingRange5Pct * 24_000,
    openingRange15Pct: openingRange5Pct * 1.2,
    closingRange15: openingRange5Pct * 10_000,
    closingRange15Pct: openingRange5Pct / 2,
    sourceStatus: "manual",
    sourceMessage: null,
  };
}
