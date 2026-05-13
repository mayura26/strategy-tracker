import type { ComboSourceRun } from "@/lib/db/repository";

export type WeightMap = Record<string, number>;

export type ComboConfigItem = {
  runId: string;
  weight: number;
};

export type ComboDay = {
  tradingDate: string;
  row: Record<string, number>;
  total: number;
  values: number[];
  best: {
    name: string;
    value: number;
  };
  worst: {
    name: string;
    value: number;
  };
  activeRuns: number;
};

export function buildWeightedCombo(runs: ComboSourceRun[], weights: WeightMap) {
  const dayMap = new Map<string, Record<string, number>>();
  const runNames = new Map(runs.map((run) => [run.id, run.name]));

  for (const run of runs) {
    const weight = weights[run.id] ?? 0;

    if (weight === 0) {
      continue;
    }

    for (const day of run.dailyMetrics) {
      const row = dayMap.get(day.tradingDate) ?? {};
      row[run.id] = day.netProfit * weight;
      dayMap.set(day.tradingDate, row);
    }
  }

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let winDays = 0;

  const selectedIds = Object.entries(weights)
    .filter(([, weight]) => weight !== 0)
    .map(([runId]) => runId);
  let allWinDays = 0;
  let allLossDays = 0;
  let mixedDays = 0;
  let onlyOneWinDays = 0;
  const days = [...dayMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tradingDate, row]) => {
      const values = selectedIds.map((runId) => row[runId] ?? 0);
      const total = values.reduce((sum, value) => sum + value, 0);
      const componentRows = selectedIds.map((runId) => ({
        name: runNames.get(runId) ?? "Run",
        value: row[runId] ?? 0,
      }));
      const best = componentRows.reduce(
        (current, candidate) =>
          candidate.value > current.value ? candidate : current,
        componentRows[0] ?? { name: "n/a", value: 0 },
      );
      const worst = componentRows.reduce(
        (current, candidate) =>
          candidate.value < current.value ? candidate : current,
        componentRows[0] ?? { name: "n/a", value: 0 },
      );

      return {
        tradingDate,
        row,
        total,
        values,
        best,
        worst,
        activeRuns: values.filter((value) => value !== 0).length,
      };
    });

  for (const day of days) {
    cumulative += day.total;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);

    if (day.total > 0) {
      winDays += 1;
    }

    const positives = day.values.filter((value) => value > 0).length;
    const negatives = day.values.filter((value) => value < 0).length;

    if (selectedIds.length > 0 && positives === selectedIds.length) {
      allWinDays += 1;
    }

    if (selectedIds.length > 0 && negatives === selectedIds.length) {
      allLossDays += 1;
    }

    if (positives > 0 && negatives > 0) {
      mixedDays += 1;
    }

    if (positives === 1) {
      onlyOneWinDays += 1;
    }
  }

  return {
    days,
    netProfit: cumulative,
    maxDrawdown,
    winDayRate: days.length === 0 ? 0 : winDays / days.length,
    allWinDays,
    allLossDays,
    mixedDays,
    onlyOneWinDays,
    correlation: calculateCorrelation(days, selectedIds),
    topDays: [...days]
      .sort((left, right) => Math.abs(right.total) - Math.abs(left.total))
      .slice(0, 16),
  };
}

export function weightsFromComboConfig(config: ComboConfigItem[]): WeightMap {
  return Object.fromEntries(
    config
      .filter((item) => item.runId && Number.isFinite(item.weight))
      .map((item) => [item.runId, item.weight]),
  );
}

function calculateCorrelation(
  days: Array<{ row: Record<string, number> }>,
  selectedIds: string[],
) {
  if (selectedIds.length !== 2) {
    return null;
  }

  const pairs = days
    .map((day) => [day.row[selectedIds[0]], day.row[selectedIds[1]]])
    .filter(
      (pair): pair is [number, number] =>
        Number.isFinite(pair[0]) && Number.isFinite(pair[1]),
    );

  if (pairs.length < 2) {
    return null;
  }

  const leftMean = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length;
  const rightMean =
    pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
  const numerator = pairs.reduce(
    (sum, pair) => sum + (pair[0] - leftMean) * (pair[1] - rightMean),
    0,
  );
  const leftDenominator = Math.sqrt(
    pairs.reduce((sum, pair) => sum + (pair[0] - leftMean) ** 2, 0),
  );
  const rightDenominator = Math.sqrt(
    pairs.reduce((sum, pair) => sum + (pair[1] - rightMean) ** 2, 0),
  );

  if (leftDenominator === 0 || rightDenominator === 0) {
    return null;
  }

  return numerator / (leftDenominator * rightDenominator);
}
