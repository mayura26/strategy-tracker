"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { formatCurrency, formatPercent, toneClass } from "@/lib/format";
import {
  type PredictiveBucketSummary,
  type PredictiveRegimeDay,
  summarizePredictiveCategory,
  summarizePredictiveThreshold,
} from "@/lib/regime-features";

export function RegimeDiscoveryWorkbench({
  days,
  emaLabel,
  rsiPeriod,
}: {
  days: PredictiveRegimeDay[];
  emaLabel: string;
  rsiPeriod: number;
}) {
  const defaultAtr = median(
    days
      .map((day) => day.previousAtr14)
      .filter((value): value is number => value !== null),
  );
  const [atrThreshold, setAtrThreshold] = useState(
    Number(defaultAtr.toFixed(2)),
  );
  const [rsiThreshold, setRsiThreshold] = useState(50);
  const atrSummary = useMemo(
    () => summarizePredictiveThreshold(days, "previousAtr14", atrThreshold),
    [days, atrThreshold],
  );
  const rsiSummary = useMemo(
    () => summarizePredictiveThreshold(days, "previousRsi", rsiThreshold),
    [days, rsiThreshold],
  );
  const stackSummary = useMemo(
    () => summarizePredictiveCategory(days, "previousEmaStack"),
    [days],
  );
  const fastMidCrossSummary = useMemo(
    () => summarizePredictiveCategory(days, "previousEmaCrossFastMid"),
    [days],
  );
  const midSlowCrossSummary = useMemo(
    () => summarizePredictiveCategory(days, "previousEmaCrossMidSlow"),
    [days],
  );

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Predictive regime workbench</h2>
          <p>
            Uses prior-session market state only. EMA {emaLabel}, RSI{" "}
            {rsiPeriod}.
          </p>
        </div>
        <SlidersHorizontal aria-hidden className="quiet-text" size={20} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ThresholdPanel
          label="Previous ATR14"
          onChange={setAtrThreshold}
          step="0.25"
          summary={[atrSummary.above, atrSummary.below]}
          value={atrThreshold}
        />
        <ThresholdPanel
          label={`Previous RSI${rsiPeriod}`}
          onChange={setRsiThreshold}
          step="1"
          summary={[rsiSummary.above, rsiSummary.below]}
          value={rsiThreshold}
        />
      </div>

      <section className="mt-5 grid gap-4 xl:grid-cols-3">
        <CategoryPanel title="Previous EMA stack" rows={stackSummary} />
        <CategoryPanel title="Fast / mid cross" rows={fastMidCrossSummary} />
        <CategoryPanel title="Mid / slow cross" rows={midSlowCrossSummary} />
      </section>
    </section>
  );
}

function ThresholdPanel({
  label,
  value,
  step,
  summary,
  onChange,
}: {
  label: string;
  value: number;
  step: string;
  summary: PredictiveBucketSummary[];
  onChange: (value: number) => void;
}) {
  return (
    <div className="subtle-card p-4">
      <label className="grid gap-2">
        <span className="label-text">{label} threshold</span>
        <input
          className="input"
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
          type="number"
          value={value}
        />
      </label>
      <div className="mt-4 grid gap-3">
        {summary.map((row) => (
          <SummaryRow key={row.label} row={row} />
        ))}
      </div>
    </div>
  );
}

function CategoryPanel({
  title,
  rows,
}: {
  title: string;
  rows: PredictiveBucketSummary[];
}) {
  return (
    <div className="subtle-card p-4">
      <div className="chart-heading">
        <span>{title}</span>
      </div>
      {rows.length === 0 ? (
        <p className="quiet-text text-sm">Not enough prior data yet.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <SummaryRow key={`${title}-${row.label}`} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ row }: { row: PredictiveBucketSummary }) {
  return (
    <div className="rounded-sm border border-slate-800 bg-slate-950/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="strong-text font-semibold capitalize">
          {row.label}
        </span>
        <span className={toneClass(row.averagePnl)}>
          {formatCurrency(row.averagePnl)}
        </span>
      </div>
      <div className="quiet-text mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <span>{row.count} days</span>
        <span>Total {formatCurrency(row.totalPnl)}</span>
        <span>Win {formatPercent(row.winRate)}</span>
        <span>
          {formatCurrency(row.bestDay)} / {formatCurrency(row.worstDay)}
        </span>
      </div>
    </div>
  );
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
