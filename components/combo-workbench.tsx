"use client";

import { Save } from "lucide-react";
import { useMemo, useState } from "react";

import { saveComboAction } from "@/app/actions";
import { buildWeightedCombo, type WeightMap } from "@/lib/combo-analytics";
import type { ComboSourceRun } from "@/lib/db/repository";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  toneClass,
} from "@/lib/format";

export function ComboWorkbench({ runs }: { runs: ComboSourceRun[] }) {
  const [weights, setWeights] = useState<WeightMap>(
    Object.fromEntries(runs.slice(0, 2).map((run) => [run.id, 1])),
  );

  const combo = useMemo(
    () => buildWeightedCombo(runs, weights),
    [runs, weights],
  );
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
