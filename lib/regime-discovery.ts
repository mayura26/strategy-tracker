import type { DailyRunMetric } from "@/lib/analytics";

export type RegimeDiscoveryDay = DailyRunMetric & {
  atr14?: number | null;
  range?: number | null;
  gap?: number | null;
};

export type ThresholdSuggestion = {
  key: string;
  feature: "ATR 14" | "Range" | "Gap" | "Absolute gap";
  condition: string;
  threshold: number;
  selectedCount: number;
  otherCount: number;
  selectedAveragePnl: number;
  otherAveragePnl: number;
  lift: number;
  selectedWinRate: number;
  selectedTotalPnl: number;
  action: "favor" | "avoid";
};

const quantiles = [0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8];

export function discoverRegimeThresholds(
  days: RegimeDiscoveryDay[],
  options: { minDays?: number; limit?: number } = {},
): ThresholdSuggestion[] {
  const minDays =
    options.minDays ?? Math.max(3, Math.floor(days.length * 0.12));
  const limit = options.limit ?? 6;
  const suggestions = [
    ...discoverFeature(days, "ATR 14", "atr14", minDays),
    ...discoverFeature(days, "Range", "range", minDays),
    ...discoverFeature(days, "Absolute gap", "absGap", minDays),
    ...discoverFeature(days, "Gap", "gap", minDays),
  ];

  return suggestions
    .sort((left, right) => score(right) - score(left))
    .slice(0, limit);
}

function discoverFeature(
  days: RegimeDiscoveryDay[],
  feature: ThresholdSuggestion["feature"],
  field: "atr14" | "range" | "gap" | "absGap",
  minDays: number,
) {
  const values = days
    .map((day) => valueFor(day, field))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const thresholds = unique(
    quantiles.map((quantile) => quantileValue(values, quantile)),
  );
  const suggestions: ThresholdSuggestion[] = [];

  for (const threshold of thresholds) {
    suggestions.push(
      ...evaluateThreshold(days, feature, field, threshold, "gte", minDays),
    );
    suggestions.push(
      ...evaluateThreshold(days, feature, field, threshold, "lt", minDays),
    );
  }

  return suggestions;
}

function evaluateThreshold(
  days: RegimeDiscoveryDay[],
  feature: ThresholdSuggestion["feature"],
  field: "atr14" | "range" | "gap" | "absGap",
  threshold: number,
  operator: "gte" | "lt",
  minDays: number,
): ThresholdSuggestion[] {
  const eligibleDays = days.filter((day) => valueFor(day, field) !== null);
  const selected = eligibleDays.filter((day) => {
    const value = valueFor(day, field) ?? 0;
    return operator === "gte" ? value >= threshold : value < threshold;
  });
  const other = eligibleDays.filter((day) => !selected.includes(day));

  if (selected.length < minDays || other.length < minDays) {
    return [];
  }

  const selectedAveragePnl = averagePnl(selected);
  const otherAveragePnl = averagePnl(other);
  const lift = selectedAveragePnl - otherAveragePnl;
  const condition = `${feature} ${operator === "gte" ? ">=" : "<"} ${threshold.toFixed(2)}`;

  return [
    {
      key: `${field}-${operator}-${threshold}`,
      feature,
      condition,
      threshold,
      selectedCount: selected.length,
      otherCount: other.length,
      selectedAveragePnl,
      otherAveragePnl,
      lift,
      selectedWinRate:
        selected.filter((day) => day.netProfit > 0).length / selected.length,
      selectedTotalPnl: selected.reduce((sum, day) => sum + day.netProfit, 0),
      action: lift >= 0 ? "favor" : "avoid",
    },
  ];
}

function valueFor(
  day: RegimeDiscoveryDay,
  field: "atr14" | "range" | "gap" | "absGap",
) {
  if (field === "absGap") {
    return day.gap === null || day.gap === undefined ? null : Math.abs(day.gap);
  }

  return day[field] ?? null;
}

function averagePnl(days: RegimeDiscoveryDay[]) {
  return days.reduce((sum, day) => sum + day.netProfit, 0) / days.length;
}

function quantileValue(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const position = (sortedValues.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function unique(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value)))];
}

function score(suggestion: ThresholdSuggestion) {
  return Math.abs(suggestion.lift) * Math.sqrt(suggestion.selectedCount);
}
