import type { DailyRunMetric } from "@/lib/analytics";
import type { AnalysisSettings, MarketBar } from "@/lib/db/repository";
import { buildPredictiveRegimeDays } from "@/lib/regime-features";

export type DistributionSummary = {
  count: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  iqr: number;
  lowerWhisker: number;
  upperWhisker: number;
  outlierCount: number;
  outliers: number[];
};

export type DayBucket =
  | "all"
  | "candidate-wins"
  | "golden-wins"
  | "both-win"
  | "both-loss"
  | "disagreement";

export type AlignedDay = {
  tradingDate: string;
  goldenPnl: number;
  candidatePnl: number;
  delta: number;
  goldenTrades: number;
  candidateTrades: number;
};

export type AlignmentMode = "overlap" | "union";

export type HistogramBin = {
  start: number;
  end: number;
  count: number;
};

export type OutcomeSummary = {
  greenDays: number;
  redDays: number;
  flatDays: number;
  greenRate: number;
  redRate: number;
  totalPnl: number;
  averageGreen: number | null;
  averageRed: number | null;
  bestDay: number | null;
  worstDay: number | null;
};

export type OutperformanceSummary = {
  totalDays: number;
  candidateBeats: number;
  goldenBeats: number;
  tiedDays: number;
  candidateThresholdBeats: number;
  goldenThresholdBeats: number;
  threshold: number;
  candidateTotalDelta: number;
  goldenTotalDelta: number;
  biggestCandidateBeat: number | null;
  biggestGoldenBeat: number | null;
};

export type ModeSwitchOperator = "gt" | "gte" | "lt" | "lte";

export type ModeSwitchRule = {
  operator: ModeSwitchOperator;
  threshold: number;
};

export type ModeSwitchDay = {
  tradingDate: string;
  previousRsi: number;
  modeAPnl: number;
  modeBPnl: number;
  modeATrades: number;
  modeBTrades: number;
  selectedMode: "mode-a" | "mode-b";
  switchedPnl: number;
  bestAvailablePnl: number;
  opportunityCost: number;
};

export type ModeSwitchMetrics = {
  totalPnl: number;
  maxDrawdown: number;
  winDayRate: number;
  expectancy: number;
  greenDays: number;
  redDays: number;
  flatDays: number;
};

export type ModeSwitchSummary = ModeSwitchMetrics & {
  totalDays: number;
  modeADays: number;
  modeBDays: number;
  comparedOverlapDays: number;
  excludedNoSignalDays: number;
  avoidedLossModeA: number;
  avoidedLossModeB: number;
  missedWinModeA: number;
  missedWinModeB: number;
  alwaysA: ModeSwitchMetrics;
  alwaysB: ModeSwitchMetrics;
};

export type ModeSwitchEvaluation = {
  days: ModeSwitchDay[];
  summary: ModeSwitchSummary;
};

export type ModeSwitchCandidate = {
  rule: ModeSwitchRule;
  evaluation: ModeSwitchEvaluation;
  improvementVsBestAlways: number;
  improvementVsModeA: number;
  improvementVsModeB: number;
};

export function summarizeDistribution(values: number[]): DistributionSummary {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return {
      count: 0,
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
      iqr: 0,
      lowerWhisker: 0,
      upperWhisker: 0,
      outlierCount: 0,
      outliers: [],
    };
  }

  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - iqr * 1.5;
  const upperFence = q3 + iqr * 1.5;
  const inliers = sorted.filter(
    (value) => value >= lowerFence && value <= upperFence,
  );
  const outliers = sorted.filter(
    (value) => value < lowerFence || value > upperFence,
  );

  return {
    count: sorted.length,
    min: sorted[0],
    q1,
    median,
    q3,
    max: sorted.at(-1) ?? sorted[0],
    iqr,
    lowerWhisker: inliers[0] ?? sorted[0],
    upperWhisker: inliers.at(-1) ?? sorted.at(-1) ?? sorted[0],
    outlierCount: outliers.length,
    outliers,
  };
}

export function buildHistogram(
  values: number[],
  targetBinCount = 12,
  bounds?: { min: number; max: number },
): HistogramBin[] {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return [];
  }

  const min = Math.min(bounds?.min ?? Math.min(...finiteValues), 0);
  const max = Math.max(bounds?.max ?? Math.max(...finiteValues), 0);
  const step = niceStep((max - min || 1) / targetBinCount);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const binCount = Math.max(1, Math.ceil((end - start) / step));
  const bins = Array.from({ length: binCount }, (_, index) => ({
    start: start + index * step,
    end: start + (index + 1) * step,
    count: 0,
  }));

  for (const value of finiteValues) {
    const index = Math.min(Math.floor((value - start) / step), bins.length - 1);
    bins[Math.max(index, 0)].count += 1;
  }

  return bins;
}

export function summarizeOutcomes(values: number[]): OutcomeSummary {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  const greenValues = finiteValues.filter((value) => value > 0);
  const redValues = finiteValues.filter((value) => value < 0);
  const flatDays = finiteValues.length - greenValues.length - redValues.length;

  return {
    greenDays: greenValues.length,
    redDays: redValues.length,
    flatDays,
    greenRate:
      finiteValues.length === 0 ? 0 : greenValues.length / finiteValues.length,
    redRate:
      finiteValues.length === 0 ? 0 : redValues.length / finiteValues.length,
    totalPnl: finiteValues.reduce((sum, value) => sum + value, 0),
    averageGreen: average(greenValues),
    averageRed: average(redValues),
    bestDay: finiteValues.length === 0 ? null : Math.max(...finiteValues),
    worstDay: finiteValues.length === 0 ? null : Math.min(...finiteValues),
  };
}

export function summarizeOutperformance(
  days: AlignedDay[],
  threshold: number,
): OutperformanceSummary {
  const normalizedThreshold = Math.max(threshold, 0);
  const candidateBeatDays = days.filter((day) => day.delta > 0);
  const goldenBeatDays = days.filter((day) => day.delta < 0);

  return {
    totalDays: days.length,
    candidateBeats: candidateBeatDays.length,
    goldenBeats: goldenBeatDays.length,
    tiedDays: days.filter((day) => day.delta === 0).length,
    candidateThresholdBeats: candidateBeatDays.filter(
      (day) => day.delta >= normalizedThreshold,
    ).length,
    goldenThresholdBeats: goldenBeatDays.filter(
      (day) => Math.abs(day.delta) >= normalizedThreshold,
    ).length,
    threshold: normalizedThreshold,
    candidateTotalDelta: candidateBeatDays.reduce(
      (sum, day) => sum + day.delta,
      0,
    ),
    goldenTotalDelta: goldenBeatDays.reduce(
      (sum, day) => sum + Math.abs(day.delta),
      0,
    ),
    biggestCandidateBeat:
      candidateBeatDays.length === 0
        ? null
        : Math.max(...candidateBeatDays.map((day) => day.delta)),
    biggestGoldenBeat:
      goldenBeatDays.length === 0
        ? null
        : Math.max(...goldenBeatDays.map((day) => Math.abs(day.delta))),
  };
}

export function evaluateModeSwitchRule({
  modeADays,
  modeBDays,
  marketBars,
  settings,
  rule,
}: {
  modeADays: DailyRunMetric[];
  modeBDays: DailyRunMetric[];
  marketBars: MarketBar[];
  settings: AnalysisSettings;
  rule: ModeSwitchRule;
}): ModeSwitchEvaluation {
  const overlapDays = alignDailyPnL(modeADays, modeBDays, "overlap");
  const predictiveByDate = new Map(
    buildPredictiveRegimeDays(modeADays, marketBars, settings).map((day) => [
      day.tradingDate,
      day,
    ]),
  );
  const days = overlapDays
    .map((day): ModeSwitchDay | null => {
      const predictiveDay = predictiveByDate.get(day.tradingDate);
      const previousRsi = predictiveDay?.previousRsi;

      if (previousRsi === null || previousRsi === undefined) {
        return null;
      }

      const selectsModeA = evaluateSwitchCondition(previousRsi, rule);
      const switchedPnl = selectsModeA ? day.goldenPnl : day.candidatePnl;
      const bestAvailablePnl = Math.max(day.goldenPnl, day.candidatePnl);

      return {
        bestAvailablePnl,
        modeAPnl: day.goldenPnl,
        modeATrades: day.goldenTrades,
        modeBPnl: day.candidatePnl,
        modeBTrades: day.candidateTrades,
        opportunityCost: bestAvailablePnl - switchedPnl,
        previousRsi,
        selectedMode: selectsModeA ? "mode-a" : "mode-b",
        switchedPnl,
        tradingDate: day.tradingDate,
      };
    })
    .filter((day): day is ModeSwitchDay => day !== null);

  return {
    days,
    summary: summarizeModeSwitchDays(days, overlapDays.length),
  };
}

export function discoverModeSwitchRules({
  modeADays,
  modeBDays,
  marketBars,
  settings,
  thresholds = defaultSwitchThresholds(),
  minDays = 5,
  limit = 6,
}: {
  modeADays: DailyRunMetric[];
  modeBDays: DailyRunMetric[];
  marketBars: MarketBar[];
  settings: AnalysisSettings;
  thresholds?: number[];
  minDays?: number;
  limit?: number;
}): ModeSwitchCandidate[] {
  const candidates: ModeSwitchCandidate[] = [];
  const operators: ModeSwitchOperator[] = ["gt", "gte", "lt", "lte"];

  for (const threshold of thresholds) {
    for (const operator of operators) {
      const rule = { operator, threshold };
      const evaluation = evaluateModeSwitchRule({
        marketBars,
        modeADays,
        modeBDays,
        rule,
        settings,
      });

      if (
        evaluation.summary.totalDays < minDays ||
        evaluation.summary.modeADays === 0 ||
        evaluation.summary.modeBDays === 0
      ) {
        continue;
      }

      const improvementVsModeA =
        evaluation.summary.totalPnl - evaluation.summary.alwaysA.totalPnl;
      const improvementVsModeB =
        evaluation.summary.totalPnl - evaluation.summary.alwaysB.totalPnl;

      candidates.push({
        evaluation,
        improvementVsBestAlways: Math.min(
          improvementVsModeA,
          improvementVsModeB,
        ),
        improvementVsModeA,
        improvementVsModeB,
        rule,
      });
    }
  }

  return candidates
    .sort((left, right) => {
      const scoreDelta =
        right.improvementVsBestAlways - left.improvementVsBestAlways;

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return (
        right.evaluation.summary.totalPnl - left.evaluation.summary.totalPnl
      );
    })
    .slice(0, limit);
}

export function evaluateSwitchCondition(value: number, rule: ModeSwitchRule) {
  if (rule.operator === "gt") {
    return value > rule.threshold;
  }

  if (rule.operator === "gte") {
    return value >= rule.threshold;
  }

  if (rule.operator === "lt") {
    return value < rule.threshold;
  }

  return value <= rule.threshold;
}

export function alignDailyPnL(
  goldenDays: DailyRunMetric[],
  candidateDays: DailyRunMetric[],
  mode: AlignmentMode = "union",
): AlignedDay[] {
  const goldenMap = new Map(goldenDays.map((day) => [day.tradingDate, day]));
  const candidateMap = new Map(
    candidateDays.map((day) => [day.tradingDate, day]),
  );
  const keys =
    mode === "overlap"
      ? [...goldenMap.keys()]
          .filter((key) => candidateMap.has(key))
          .sort((left, right) => left.localeCompare(right))
      : [...new Set([...goldenMap.keys(), ...candidateMap.keys()])].sort(
          (left, right) => left.localeCompare(right),
        );

  return keys.map((tradingDate) => {
    const golden = goldenMap.get(tradingDate);
    const candidate = candidateMap.get(tradingDate);
    const goldenPnl = golden?.netProfit ?? 0;
    const candidatePnl = candidate?.netProfit ?? 0;

    return {
      tradingDate,
      goldenPnl,
      candidatePnl,
      delta: candidatePnl - goldenPnl,
      goldenTrades: golden?.tradeCount ?? 0,
      candidateTrades: candidate?.tradeCount ?? 0,
    };
  });
}

function summarizeModeSwitchDays(
  days: ModeSwitchDay[],
  comparedOverlapDays: number,
): ModeSwitchSummary {
  const switchedValues = days.map((day) => day.switchedPnl);
  const modeAValues = days.map((day) => day.modeAPnl);
  const modeBValues = days.map((day) => day.modeBPnl);

  return {
    ...metricsFromValues(switchedValues),
    alwaysA: metricsFromValues(modeAValues),
    alwaysB: metricsFromValues(modeBValues),
    avoidedLossModeA: days.filter(
      (day) => day.selectedMode === "mode-b" && day.modeAPnl < 0,
    ).length,
    avoidedLossModeB: days.filter(
      (day) => day.selectedMode === "mode-a" && day.modeBPnl < 0,
    ).length,
    comparedOverlapDays,
    excludedNoSignalDays: comparedOverlapDays - days.length,
    missedWinModeA: days.filter(
      (day) => day.selectedMode === "mode-b" && day.modeAPnl > 0,
    ).length,
    missedWinModeB: days.filter(
      (day) => day.selectedMode === "mode-a" && day.modeBPnl > 0,
    ).length,
    modeADays: days.filter((day) => day.selectedMode === "mode-a").length,
    modeBDays: days.filter((day) => day.selectedMode === "mode-b").length,
    totalDays: days.length,
  };
}

function metricsFromValues(values: number[]): ModeSwitchMetrics {
  const outcomes = summarizeOutcomes(values);

  return {
    expectancy:
      values.length === 0
        ? 0
        : values.reduce((sum, value) => sum + value, 0) / values.length,
    flatDays: outcomes.flatDays,
    greenDays: outcomes.greenDays,
    maxDrawdown: calculateDrawdown(values),
    redDays: outcomes.redDays,
    totalPnl: outcomes.totalPnl,
    winDayRate: outcomes.greenRate,
  };
}

function calculateDrawdown(values: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }

  return maxDrawdown;
}

function defaultSwitchThresholds() {
  return Array.from({ length: 17 }, (_, index) => 10 + index * 5);
}

export function filterAlignedDays(
  days: AlignedDay[],
  options: {
    bucket: DayBucket;
    hideSimilar: boolean;
    similarThreshold: number;
  },
) {
  return days.filter((day) => {
    if (options.hideSimilar && Math.abs(day.delta) < options.similarThreshold) {
      return false;
    }

    if (options.bucket === "candidate-wins") {
      return day.delta > 0;
    }

    if (options.bucket === "golden-wins") {
      return day.delta < 0;
    }

    if (options.bucket === "both-win") {
      return day.candidatePnl > 0 && day.goldenPnl > 0;
    }

    if (options.bucket === "both-loss") {
      return day.candidatePnl < 0 && day.goldenPnl < 0;
    }

    if (options.bucket === "disagreement") {
      return (
        (day.candidatePnl > 0 && day.goldenPnl < 0) ||
        (day.candidatePnl < 0 && day.goldenPnl > 0)
      );
    }

    return true;
  });
}

export function countSingleRunDays(
  days: AlignedDay[],
  side: "golden" | "candidate",
) {
  return days.filter((day) =>
    side === "golden"
      ? day.goldenTrades > 0 && day.candidateTrades === 0
      : day.candidateTrades > 0 && day.goldenTrades === 0,
  ).length;
}

export function sortAlignedDaysNewestFirst(days: AlignedDay[]) {
  return [...days].sort((left, right) =>
    right.tradingDate.localeCompare(left.tradingDate),
  );
}

export function quantile(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const position = (sortedValues.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function niceStep(rawStep: number) {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }

  if (normalized <= 2) {
    return 2 * magnitude;
  }

  if (normalized <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
