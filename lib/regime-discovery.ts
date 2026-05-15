import type { DailyRunMetric } from "@/lib/analytics";

export type RegimeDiscoveryDay = DailyRunMetric & {
  atr?: number | null;
  atr14?: number | null;
  range?: number | null;
  gap?: number | null;
  previousAtr?: number | null;
  previousAtr14?: number | null;
  openingRange5Pct?: number | null;
  openingRange10Pct?: number | null;
  openingRange15Pct?: number | null;
  previousClosingRange15Pct?: number | null;
  previousRange?: number | null;
  previousGap?: number | null;
  previousReturn?: number | null;
  previousTrueRange?: number | null;
  previousRsi?: number | null;
  previousRsiBand?: string | null;
  previousEmaStack?: string | null;
  previousEmaCrossFastMid?: string | null;
  previousEmaCrossMidSlow?: string | null;
  previousEmaCrossFastMidWithinLookback?: string | null;
  previousEmaCrossMidSlowWithinLookback?: string | null;
};

export type ThresholdSuggestion = {
  key: string;
  feature: string;
  condition: string;
  threshold: number | null;
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

type NumericField =
  | "atr"
  | "range"
  | "gap"
  | "absGap"
  | "previousAtr"
  | "openingRange5Pct"
  | "openingRange10Pct"
  | "openingRange15Pct"
  | "previousClosingRange15Pct"
  | "previousRange"
  | "previousGap"
  | "previousAbsGap"
  | "previousReturn"
  | "previousTrueRange"
  | "previousRsi";

type CategoricalField =
  | "previousEmaStack"
  | "previousEmaCrossFastMid"
  | "previousEmaCrossMidSlow"
  | "previousEmaCrossFastMidWithinLookback"
  | "previousEmaCrossMidSlowWithinLookback"
  | "previousRsiBand";

const quantiles = [0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8];

export function discoverRegimeThresholds(
  days: RegimeDiscoveryDay[],
  options: {
    minDays?: number;
    limit?: number;
    atrPeriod?: number;
    emaCrossLookbackDays?: number;
  } = {},
): ThresholdSuggestion[] {
  const minDays =
    options.minDays ?? Math.max(3, Math.floor(days.length * 0.12));
  const limit = options.limit ?? 6;
  const atrLabel = `ATR${options.atrPeriod ?? 5}`;
  const previousAtrLabel = `Previous ATR${options.atrPeriod ?? 5}`;
  const emaLookback = options.emaCrossLookbackDays ?? 5;
  const sortedDays = [...days].sort((left, right) =>
    left.tradingDate.localeCompare(right.tradingDate),
  );
  const splitIndex = Math.max(1, Math.floor(sortedDays.length * 0.7));
  const trainingDays = sortedDays.slice(0, splitIndex);
  const validationDays = sortedDays.slice(splitIndex);
  const suggestions = [
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      atrLabel,
      "atr",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      previousAtrLabel,
      "previousAtr",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Opening range 5 %",
      "openingRange5Pct",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Opening range 10 %",
      "openingRange10Pct",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Opening range 15 %",
      "openingRange15Pct",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Previous 15:45-16:00 range %",
      "previousClosingRange15Pct",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Range",
      "range",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Previous range",
      "previousRange",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Absolute gap",
      "absGap",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Previous absolute gap",
      "previousAbsGap",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Gap",
      "gap",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Previous gap",
      "previousGap",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Previous return",
      "previousReturn",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Previous true range",
      "previousTrueRange",
      minDays,
    ),
    ...discoverNumericFeature(
      trainingDays,
      validationDays,
      "Previous RSI",
      "previousRsi",
      minDays,
    ),
    ...discoverCategoricalFeature(
      trainingDays,
      validationDays,
      "Previous EMA stack",
      "previousEmaStack",
      minDays,
    ),
    ...discoverCategoricalFeature(
      trainingDays,
      validationDays,
      "Previous RSI band",
      "previousRsiBand",
      minDays,
    ),
    ...discoverCategoricalFeature(
      trainingDays,
      validationDays,
      "EMA fast/mid cross",
      "previousEmaCrossFastMid",
      minDays,
    ),
    ...discoverCategoricalFeature(
      trainingDays,
      validationDays,
      "EMA mid/slow cross",
      "previousEmaCrossMidSlow",
      minDays,
    ),
    ...discoverCategoricalFeature(
      trainingDays,
      validationDays,
      `EMA fast/mid cross within ${emaLookback} sessions`,
      "previousEmaCrossFastMidWithinLookback",
      minDays,
    ),
    ...discoverCategoricalFeature(
      trainingDays,
      validationDays,
      `EMA mid/slow cross within ${emaLookback} sessions`,
      "previousEmaCrossMidSlowWithinLookback",
      minDays,
    ),
  ];

  return suggestions
    .sort((left, right) => score(right) - score(left))
    .slice(0, limit);
}

function discoverNumericFeature(
  trainingDays: RegimeDiscoveryDay[],
  validationDays: RegimeDiscoveryDay[],
  feature: string,
  field: NumericField,
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
  feature: string,
  field: NumericField,
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
  const condition = `${feature} ${operator === "gte" ? ">=" : "<"} ${formatThreshold(field, threshold)}`;

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

function discoverCategoricalFeature(
  trainingDays: RegimeDiscoveryDay[],
  validationDays: RegimeDiscoveryDay[],
  feature: string,
  field: CategoricalField,
  minDays: number,
) {
  const values = uniqueStrings(
    trainingDays
      .map((day) => categoryFor(day, field))
      .filter((value): value is string => value !== null && value !== "none"),
  );
  const suggestions: ThresholdSuggestion[] = [];

  for (const value of values) {
    suggestions.push(
      ...evaluateCategory(
        trainingDays,
        validationDays,
        feature,
        field,
        value,
        minDays,
      ),
    );
  }

  return suggestions;
}

function evaluateCategory(
  trainingDays: RegimeDiscoveryDay[],
  validationDays: RegimeDiscoveryDay[],
  feature: string,
  field: CategoricalField,
  value: string,
  minDays: number,
): ThresholdSuggestion[] {
  const eligibleTrainingDays = trainingDays.filter(
    (day) => categoryFor(day, field) !== null,
  );
  const selected = eligibleTrainingDays.filter(
    (day) => categoryFor(day, field) === value,
  );
  const other = eligibleTrainingDays.filter((day) => !selected.includes(day));

  if (selected.length < minDays || other.length < minDays) {
    return [];
  }

  const eligibleValidationDays = validationDays.filter(
    (day) => categoryFor(day, field) !== null,
  );
  const validationSelected = eligibleValidationDays.filter(
    (day) => categoryFor(day, field) === value,
  );
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

  return [
    {
      key: `${field}-${value}`,
      feature,
      condition: `${feature} = ${formatCategory(value)}`,
      threshold: null,
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

function valueFor(day: RegimeDiscoveryDay, field: NumericField) {
  if (field === "atr") {
    return day.atr ?? day.atr14 ?? null;
  }

  if (field === "previousAtr") {
    return day.previousAtr ?? day.previousAtr14 ?? null;
  }

  if (field === "absGap") {
    return day.gap === null || day.gap === undefined ? null : Math.abs(day.gap);
  }

  if (field === "previousAbsGap") {
    return day.previousGap === null || day.previousGap === undefined
      ? null
      : Math.abs(day.previousGap);
  }

  return day[field] ?? null;
}

function categoryFor(day: RegimeDiscoveryDay, field: CategoricalField) {
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

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function formatCategory(value: string) {
  return value.replaceAll("-", " ");
}

function formatThreshold(field: NumericField, threshold: number) {
  if (
    field === "openingRange5Pct" ||
    field === "openingRange10Pct" ||
    field === "openingRange15Pct" ||
    field === "previousClosingRange15Pct"
  ) {
    return `${(threshold * 100).toFixed(2)}%`;
  }

  return threshold.toFixed(2);
}

function score(suggestion: ThresholdSuggestion) {
  const validationMultiplier = suggestion.validated ? 1.2 : 0.8;
  return (
    Math.abs(suggestion.lift) *
    Math.sqrt(suggestion.selectedCount) *
    validationMultiplier
  );
}
