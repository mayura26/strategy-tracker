"use client";

import { Save } from "lucide-react";
import { useMemo, useState } from "react";

import { saveComboAction } from "@/app/actions";
import type { ComboSourceRun } from "@/lib/db/repository";
import { formatCurrency, formatPercent } from "@/lib/format";

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
        <div className="divide-y divide-stone-200">
          {runs.map((run) => (
            <label
              className="grid gap-4 py-4 md:grid-cols-[1fr_160px]"
              key={run.id}
            >
              <span>
                <span className="block font-medium text-stone-950">
                  {run.name}
                </span>
                <span className="text-sm text-stone-500">
                  {run.botName} / {run.instrumentSymbol} / {run.timeframe}
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
          <Metric label="Both win days" value={String(combo.bothWinDays)} />
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
  let bothWinDays = 0;

  const selectedIds = Object.entries(weights)
    .filter(([, weight]) => weight !== 0)
    .map(([runId]) => runId);
  const days = [...dayMap.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );

  for (const [, row] of days) {
    const netProfit = Object.values(row).reduce((sum, value) => sum + value, 0);
    cumulative += netProfit;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);

    if (netProfit > 0) {
      winDays += 1;
    }

    if (
      selectedIds.length >= 2 &&
      selectedIds.every((runId) => (row[runId] ?? 0) > 0)
    ) {
      bothWinDays += 1;
    }
  }

  return {
    days,
    netProfit: cumulative,
    maxDrawdown,
    winDayRate: days.length === 0 ? 0 : winDays / days.length,
    bothWinDays,
  };
}
