"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { formatCurrency, formatPercent, toneClass } from "@/lib/format";
import {
  type PredictiveBucketSummary,
  type PredictiveRegimeDay,
  summarizePredictiveCategory,
  summarizePredictiveRsiBands,
  summarizePredictiveThreshold,
} from "@/lib/regime-features";

export function RegimeDiscoveryWorkbench({
  days,
  emaLabel,
  rsiPeriod,
  atrPeriod,
  emaCrossLookbackDays,
  rsiLowerBand,
  rsiUpperBand,
}: {
  days: PredictiveRegimeDay[];
  emaLabel: string;
  rsiPeriod: number;
  atrPeriod: number;
  emaCrossLookbackDays: number;
  rsiLowerBand: number;
  rsiUpperBand: number;
}) {
  const defaultAtr = median(
    days
      .map((day) => day.previousAtr)
      .filter((value): value is number => value !== null),
  );
  const [atrThreshold, setAtrThreshold] = useState(
    Number(defaultAtr.toFixed(2)),
  );
  const [rsiBand, setRsiBand] = useState(
    Math.max(0, Math.min(rsiLowerBand, 100 - rsiUpperBand, 49)),
  );
  const rsiUpper = 100 - rsiBand;
  const atrSummary = useMemo(
    () =>
      summarizePredictiveThreshold(
        days,
        "previousAtr",
        atrThreshold,
        `Previous ATR${atrPeriod}`,
      ),
    [days, atrThreshold, atrPeriod],
  );
  const rsiBandSummary = useMemo(
    () => summarizePredictiveRsiBands(days, rsiBand),
    [days, rsiBand],
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
  const fastMidLookbackSummary = useMemo(
    () =>
      summarizePredictiveCategory(
        days,
        "previousEmaCrossFastMidWithinLookback",
      ),
    [days],
  );
  const midSlowLookbackSummary = useMemo(
    () =>
      summarizePredictiveCategory(
        days,
        "previousEmaCrossMidSlowWithinLookback",
      ),
    [days],
  );

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Predictive regime workbench</h2>
          <p>
            Uses prior-session market state only. EMA {emaLabel}, RSI{" "}
            {rsiPeriod}, ATR{atrPeriod}.
          </p>
        </div>
        <SlidersHorizontal aria-hidden className="quiet-text" size={20} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ThresholdPanel
          label={`Previous ATR${atrPeriod}`}
          onChange={setAtrThreshold}
          step="0.25"
          summary={[atrSummary.above, atrSummary.below]}
          value={atrThreshold}
        />
        <RsiBandPanel
          lowerBand={rsiBand}
          onChange={setRsiBand}
          rsiPeriod={rsiPeriod}
          summary={rsiBandSummary}
          upperBand={rsiUpper}
        />
      </div>

      <section className="mt-5 grid gap-4 xl:grid-cols-3">
        <CategoryPanel title="Previous EMA stack" rows={stackSummary} />
        <CategoryPanel title="Fast / mid cross" rows={fastMidCrossSummary} />
        <CategoryPanel title="Mid / slow cross" rows={midSlowCrossSummary} />
        <CategoryPanel
          title={`Fast / mid cross within ${emaCrossLookbackDays}`}
          rows={fastMidLookbackSummary}
        />
        <CategoryPanel
          title={`Mid / slow cross within ${emaCrossLookbackDays}`}
          rows={midSlowLookbackSummary}
        />
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

function RsiBandPanel({
  lowerBand,
  upperBand,
  rsiPeriod,
  summary,
  onChange,
}: {
  lowerBand: number;
  upperBand: number;
  rsiPeriod: number;
  summary: PredictiveBucketSummary[];
  onChange: (value: number) => void;
}) {
  return (
    <div className="subtle-card p-4">
      <label className="grid gap-2">
        <span className="label-text">Previous RSI{rsiPeriod} band</span>
        <input
          className="input"
          max="49"
          min="0"
          onChange={(event) =>
            onChange(Math.max(0, Math.min(Number(event.target.value), 49)))
          }
          step="1"
          type="number"
          value={lowerBand}
        />
      </label>
      <p className="quiet-text mt-2 text-xs">
        Band {lowerBand} creates RSI &lt; {lowerBand}, {lowerBand}-{upperBand},
        and RSI &gt; {upperBand}.
      </p>
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
