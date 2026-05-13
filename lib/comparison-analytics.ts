import type { DailyRunMetric } from "@/lib/analytics";

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

export function alignDailyPnL(
  goldenDays: DailyRunMetric[],
  candidateDays: DailyRunMetric[],
): AlignedDay[] {
  const goldenMap = new Map(goldenDays.map((day) => [day.tradingDate, day]));
  const candidateMap = new Map(
    candidateDays.map((day) => [day.tradingDate, day]),
  );
  const keys = [...new Set([...goldenMap.keys(), ...candidateMap.keys()])].sort(
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
