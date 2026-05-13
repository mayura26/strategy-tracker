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
  validationCount: number;
  validationAveragePnl: number | null;
  validationOtherAveragePnl: number | null;
  validationLift: number | null;
  validationWinRate: number | null;
  validated: boolean;
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
  const sortedDays = [...days].sort((left, right) =>
    left.tradingDate.localeCompare(right.tradingDate),
  );
  const splitIndex = Math.max(1, Math.floor(sortedDays.length * 0.7));
  const trainingDays = sortedDays.slice(0, splitIndex);
  const validationDays = sortedDays.slice(splitIndex);
  const suggestions = [
    ...discoverFeature(
      trainingDays,
      validationDays,
      "ATR 14",
      "atr14",
      minDays,
    ),
    ...discoverFeature(trainingDays, validationDays, "Range", "range", minDays),
    ...discoverFeature(
      trainingDays,
      validationDays,
      "Absolute gap",
      "absGap",
      minDays,
    ),
    ...discoverFeature(trainingDays, validationDays, "Gap", "gap", minDays),
  ];

  return suggestions
    .sort((left, right) => score(right) - score(left))
    .slice(0, limit);
}

function discoverFeature(
  trainingDays: RegimeDiscoveryDay[],
  validationDays: RegimeDiscoveryDay[],
  feature: ThresholdSuggestion["feature"],
  field: "atr14" | "range" | "gap" | "absGap",
  minDays: number,
) {
  const values = trainingDays
    .map((day) => valueFor(day, field))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const thresholds = unique(
    quantiles.map((quantile) => quantileValue(values, quantile)),
  );
  const suggestions: ThresholdSuggestion[] = [];

  for (const threshold of thresholds) {
    suggestions.push(
      ...evaluateThreshold(
        trainingDays,
        validationDays,
        feature,
        field,
        threshold,
        "gte",
        minDays,
      ),
    );
    suggestions.push(
      ...evaluateThreshold(
        trainingDays,
        validationDays,
        feature,
        field,
        threshold,
        "lt",
        minDays,
      ),
    );
  }

  return suggestions;
}

function evaluateThreshold(
  trainingDays: RegimeDiscoveryDay[],
  validationDays: RegimeDiscoveryDay[],
  feature: ThresholdSuggestion["feature"],
  field: "atr14" | "range" | "gap" | "absGap",
  threshold: number,
  operator: "gte" | "lt",
  minDays: number,
): ThresholdSuggestion[] {
  const eligibleTrainingDays = trainingDays.filter(
    (day) => valueFor(day, field) !== null,
  );
  const selected = eligibleTrainingDays.filter((day) => {
    const value = valueFor(day, field) ?? 0;
    return operator === "gte" ? value >= threshold : value < threshold;
  });
  const other = eligibleTrainingDays.filter((day) => !selected.includes(day));

  if (selected.length < minDays || other.length < minDays) {
    return [];
  }

  const eligibleValidationDays = validationDays.filter(
    (day) => valueFor(day, field) !== null,
  );
  const validationSelected = eligibleValidationDays.filter((day) => {
    const value = valueFor(day, field) ?? 0;
    return operator === "gte" ? value >= threshold : value < threshold;
  });
  const validationOther = eligibleValidationDays.filter(
    (day) => !validationSelected.includes(day),
  );
  const selectedAveragePnl = averagePnl(selected);
  const otherAveragePnl = averagePnl(other);
  const lift = selectedAveragePnl - otherAveragePnl;
  const validationAveragePnl =
    validationSelected.length > 0 ? averagePnl(validationSelected) : null;
  const validationOtherAveragePnl =
    validationOther.length > 0 ? averagePnl(validationOther) : null;
  const validationLift =
    validationAveragePnl !== null && validationOtherAveragePnl !== null
      ? validationAveragePnl - validationOtherAveragePnl
      : null;
  const validationWinRate =
    validationSelected.length > 0
      ? validationSelected.filter((day) => day.netProfit > 0).length /
        validationSelected.length
      : null;
  const validated =
    validationLift !== null &&
    Math.sign(validationLift) === Math.sign(lift) &&
    Math.abs(validationLift) > 0;
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
      validationCount: validationSelected.length,
      validationAveragePnl,
      validationOtherAveragePnl,
      validationLift,
      validationWinRate,
      validated,
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
  const validationMultiplier = suggestion.validated ? 1.2 : 0.8;
  return (
    Math.abs(suggestion.lift) *
    Math.sqrt(suggestion.selectedCount) *
    validationMultiplier
  );
}
