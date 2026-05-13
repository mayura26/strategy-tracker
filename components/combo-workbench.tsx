"use client";

import { Save } from "lucide-react";
import { useMemo, useState } from "react";

import { saveComboAction } from "@/app/actions";
import type { ComboSourceRun } from "@/lib/db/repository";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  toneClass,
} from "@/lib/format";

type WeightMap = Record<string, number>;

export function ComboWorkbench({ runs }: { runs: ComboSourceRun[] }) {
  const [weights, setWeights] = useState<WeightMap>(
    Object.fromEntries(runs.slice(0, 2).map((run) => [run.id, 1])),
  );

  const combo = useMemo(() => buildCombo(runs, weights), [runs, weights]);
  const configJson = JSON.stringify(
    Object.entries(weights)
      .filter(([, weight]) => weight !== 0)
      .map(([runId, weight]) => ({ runId, weight })),
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="panel">
        <div className="section-title">
          <h2>Weighted strategy overlay</h2>
          <p>Adjust contracts or research weights and inspect combined days.</p>
        </div>
        <div className="divide-y divide-slate-800/80">
          {runs.map((run) => (
            <label
              className="grid gap-4 py-4 md:grid-cols-[1fr_160px]"
              key={run.id}
            >
              <span>
                <span className="strong-text block font-medium">
                  {run.name}
                </span>
                <span className="quiet-text text-sm">
                  {run.botName} / {run.botModeName ?? "No mode"} /{" "}
                  {run.instrumentSymbol} / {run.timeframe}
                </span>
              </span>
              <input
                className="input"
                min="-10"
                name={run.id}
                onChange={(event) =>
                  setWeights((current) => ({
                    ...current,
                    [run.id]: Number(event.target.value),
                  }))
                }
                step="0.25"
                type="number"
                value={weights[run.id] ?? 0}
              />
            </label>
          ))}
        </div>
      </div>
      <aside className="panel h-fit">
        <div className="section-title">
          <h2>Combo result</h2>
          <p>{combo.days.length} overlapping and standalone trading days.</p>
        </div>
        <div className="metric-grid">
          <Metric label="Net PnL" value={formatCurrency(combo.netProfit)} />
          <Metric
            label="Max drawdown"
            value={formatCurrency(combo.maxDrawdown)}
          />
          <Metric label="Win days" value={formatPercent(combo.winDayRate)} />
          <Metric label="All win days" value={String(combo.allWinDays)} />
          <Metric label="Mixed days" value={String(combo.mixedDays)} />
          <Metric label="Correlation" value={formatNumber(combo.correlation)} />
        </div>
        <form action={saveComboAction} className="mt-6 grid gap-3">
          <input name="configJson" type="hidden" value={configJson} />
          <input
            className="input"
            name="name"
            placeholder="Combo name"
            required
          />
          <textarea
            className="input min-h-24"
            name="description"
            placeholder="Research note"
          />
          <button className="primary-button" type="submit">
            <Save aria-hidden size={16} />
            Save combo
          </button>
        </form>
      </aside>
      <div className="panel overflow-x-auto xl:col-span-2">
        <div className="section-title">
          <h2>Contribution days</h2>
          <p>Largest combined daily outcomes from the selected runs.</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Total</th>
              <th>Best component</th>
              <th>Worst component</th>
              <th>Active runs</th>
            </tr>
          </thead>
          <tbody>
            {combo.topDays.map((day) => (
              <tr key={day.tradingDate}>
                <td>{day.tradingDate}</td>
                <td className={toneClass(day.total)}>
                  {formatCurrency(day.total)}
                </td>
                <td>
                  <span className={toneClass(day.best.value)}>
                    {day.best.name}: {formatCurrency(day.best.value)}
                  </span>
                </td>
                <td>
                  <span className={toneClass(day.worst.value)}>
                    {day.worst.name}: {formatCurrency(day.worst.value)}
                  </span>
                </td>
                <td>{day.activeRuns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildCombo(runs: ComboSourceRun[], weights: WeightMap) {
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
