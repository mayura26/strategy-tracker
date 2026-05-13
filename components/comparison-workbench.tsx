"use client";

import { BarChart3, CircleDot, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  alignDailyPnL,
  buildHistogram,
  type DayBucket,
  filterAlignedDays,
  summarizeDistribution,
  summarizeOutcomes,
} from "@/lib/comparison-analytics";
import type { ComparisonGroup, ComparisonRun } from "@/lib/db/repository";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  toneClass,
} from "@/lib/format";

const dayBuckets: Array<{ value: DayBucket; label: string }> = [
  { value: "all", label: "All" },
  { value: "candidate-wins", label: "Candidate beats" },
  { value: "golden-wins", label: "Golden beats" },
  { value: "both-win", label: "Both win" },
  { value: "both-loss", label: "Both loss" },
  { value: "disagreement", label: "Disagree" },
];

export function ComparisonWorkbench({ groups }: { groups: ComparisonGroup[] }) {
  const [groupIndex, setGroupIndex] = useState(0);
  const group = groups[groupIndex] ?? groups[0];
  const golden = group?.runs.find((run) => run.isGolden) ?? group?.runs[0];
  const [candidateIdByGroup, setCandidateIdByGroup] = useState<
    Record<string, string>
  >({});
  const [bucket, setBucket] = useState<DayBucket>("all");
  const [hideSimilar, setHideSimilar] = useState(true);
  const [similarThreshold, setSimilarThreshold] = useState(50);
  const candidate =
    group?.runs.find((run) => run.id === candidateIdByGroup[group.scope]) ??
    group?.runs.find((run) => run.id !== golden?.id) ??
    golden;
  const alignedDays = useMemo(
    () =>
      golden && candidate
        ? alignDailyPnL(golden.dailyMetrics, candidate.dailyMetrics)
        : [],
    [golden, candidate],
  );
  const filteredDays = useMemo(
    () =>
      filterAlignedDays(alignedDays, {
        bucket,
        hideSimilar,
        similarThreshold,
      }),
    [alignedDays, bucket, hideSimilar, similarThreshold],
  );

  if (!group || !golden || !candidate) {
    return (
      <section className="panel grid min-h-80 place-items-center text-center">
        <div>
          <p className="empty-title text-lg font-semibold">
            No comparison data yet.
          </p>
          <p className="quiet-text mt-2 text-sm">
            Import at least one run to start building visual comparisons.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="panel grid gap-4 xl:grid-cols-[1fr_220px_220px]">
        <label className="grid gap-2">
          <span className="label-text">Comparison scope</span>
          <select
            className="input"
            onChange={(event) => setGroupIndex(Number(event.target.value))}
            value={groupIndex}
          >
            {groups.map((candidateGroup, index) => (
              <option key={candidateGroup.scope} value={index}>
                {candidateGroup.scope}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-2">
          <span className="label-text">Golden</span>
          <Link className="ghost-button" href={`/runs/${golden.id}`}>
            {golden.name}
          </Link>
        </div>
        <label className="grid gap-2">
          <span className="label-text">Candidate</span>
          <select
            className="input"
            onChange={(event) =>
              setCandidateIdByGroup((current) => ({
                ...current,
                [group.scope]: event.target.value,
              }))
            }
            value={candidate.id}
          >
            {group.runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <MetricBarComparison runs={group.runs} />

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Daily PnL overlay</h2>
            <p>
              {filteredDays.length} of {alignedDays.length} aligned days shown.
            </p>
          </div>
          <BarChart3 aria-hidden className="quiet-text" size={20} />
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <label className="grid gap-2">
            <span className="label-text">Day filter</span>
            <select
              className="input"
              onChange={(event) => setBucket(event.target.value as DayBucket)}
              value={bucket}
            >
              {dayBuckets.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label-text">Similarity threshold</span>
            <input
              className="input"
              min="0"
              onChange={(event) =>
                setSimilarThreshold(Number(event.target.value))
              }
              step="25"
              type="number"
              value={similarThreshold}
            />
          </label>
          <label className="flex items-end gap-3 pb-2">
            <input
              checked={hideSimilar}
              className="size-5 accent-amber-400"
              onChange={(event) => setHideSimilar(event.target.checked)}
              type="checkbox"
            />
            <span className="label-text pb-1">Hide similar days</span>
          </label>
        </div>
        <DailyOverlayChart
          candidateName={candidate.name}
          days={filteredDays}
          goldenName={golden.name}
        />
        <DailyDifferenceTable days={filteredDays.slice(0, 24)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <DayOutcomeVersus golden={golden} candidate={candidate} />
        <DailyHistogramComparison runs={[golden, candidate]} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DistributionPanel
          runs={[golden, candidate]}
          title="Trade PnL distribution"
          valueType="trade"
        />
        <DistributionPanel
          runs={[golden, candidate]}
          title="Daily PnL distribution"
          valueType="daily"
        />
      </section>
    </div>
  );
}

function DayOutcomeVersus({
  golden,
  candidate,
}: {
  golden: ComparisonRun;
  candidate: ComparisonRun;
}) {
  const rows = [golden, candidate].map((run) => ({
    run,
    summary: summarizeOutcomes(run.dailyMetrics.map((day) => day.netProfit)),
  }));

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Green / red days</h2>
          <p>Win-day profile before distribution shape.</p>
        </div>
      </div>
      <div className="grid gap-4">
        {rows.map(({ run, summary }) => {
          const totalDays =
            summary.greenDays + summary.redDays + summary.flatDays || 1;
          const greenWidth = (summary.greenDays / totalDays) * 100;
          const redWidth = (summary.redDays / totalDays) * 100;
          const flatWidth = Math.max(100 - greenWidth - redWidth, 0);

          return (
            <div className="grid gap-3" key={run.id}>
              <div className="flex items-center justify-between gap-3">
                <Link
                  className="link-text font-semibold"
                  href={`/runs/${run.id}`}
                >
                  {run.name}
                </Link>
                <span className={toneClass(summary.totalPnl)}>
                  {formatCurrency(summary.totalPnl)}
                </span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-900">
                <span
                  className="bg-teal-300"
                  style={{ width: `${greenWidth}%` }}
                  title={`${summary.greenDays} green days`}
                />
                <span
                  className="bg-slate-600"
                  style={{ width: `${flatWidth}%` }}
                  title={`${summary.flatDays} flat days`}
                />
                <span
                  className="bg-rose-400"
                  style={{ width: `${redWidth}%` }}
                  title={`${summary.redDays} red days`}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <OutcomeCell
                  label="Green"
                  value={`${summary.greenDays} / ${formatPercent(
                    summary.greenRate,
                  )}`}
                />
                <OutcomeCell
                  label="Red"
                  value={`${summary.redDays} / ${formatPercent(summary.redRate)}`}
                />
                <OutcomeCell label="Flat" value={String(summary.flatDays)} />
              </div>
              <div className="quiet-text grid gap-1 text-xs">
                <span>Avg green {formatCurrency(summary.averageGreen)}</span>
                <span>Avg red {formatCurrency(summary.averageRed)}</span>
                <span>
                  Best {formatCurrency(summary.bestDay)} / worst{" "}
                  {formatCurrency(summary.worstDay)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OutcomeCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="quiet-text block text-xs uppercase">{label}</span>
      <strong className="strong-text mt-1 block">{value}</strong>
    </div>
  );
}

function DailyHistogramComparison({ runs }: { runs: ComparisonRun[] }) {
  const series = runs.map((run) => ({
    run,
    values: run.dailyMetrics.map((day) => day.netProfit),
  }));
  const allValues = series.flatMap((item) => item.values);
  const bounds = {
    min: Math.min(...allValues, 0),
    max: Math.max(...allValues, 0),
  };
  const histograms = series.map(({ run, values }) => ({
    run,
    bins: buildHistogram(values, 12, bounds),
  }));
  const binRanges = histograms[0]?.bins ?? [];
  const maxCount = Math.max(
    ...histograms.flatMap((item) => item.bins.map((bin) => bin.count)),
    1,
  );

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Daily PnL histogram</h2>
          <p>
            Shared buckets reveal concentration, tails, and red-day clusters.
          </p>
        </div>
      </div>
      <div className="overflow-hidden">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `minmax(72px, 0.7fr) repeat(${binRanges.length}, minmax(0, 1fr))`,
          }}
        >
          <div />
          {binRanges.map((bin) => (
            <div
              className="quiet-text flex min-h-9 items-end justify-center text-center text-[0.6rem] leading-tight"
              key={`${bin.start}-${bin.end}`}
              title={formatBucket(bin.start, bin.end)}
            >
              {formatCompactBucket(bin.start, bin.end)}
            </div>
          ))}
          {histograms.map(({ run, bins }) => (
            <HistogramRunRow
              bins={bins}
              key={run.id}
              maxCount={maxCount}
              run={run}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function HistogramRunRow({
  run,
  bins,
  maxCount,
}: {
  run: ComparisonRun;
  bins: ReturnType<typeof buildHistogram>;
  maxCount: number;
}) {
  return (
    <>
      <Link
        className="link-text self-end truncate pb-1 pr-2 text-sm font-semibold"
        href={`/runs/${run.id}`}
        title={run.name}
      >
        {run.name}
      </Link>
      {bins.map((bin) => {
        const height = Math.max(
          (bin.count / maxCount) * 100,
          bin.count ? 7 : 0,
        );
        const isLossBucket = bin.end <= 0;
        const isMixedBucket = bin.start < 0 && bin.end > 0;

        return (
          <div
            className="flex h-36 items-end border-b border-slate-800"
            key={`${run.id}-${bin.start}-${bin.end}`}
            title={`${run.name}: ${formatBucket(bin.start, bin.end)} = ${bin.count} days`}
          >
            <div
              className={
                isLossBucket
                  ? "w-full rounded-t-sm bg-rose-400"
                  : isMixedBucket
                    ? "w-full rounded-t-sm bg-slate-500"
                    : "w-full rounded-t-sm bg-teal-300"
              }
              style={{ height: `${height}%` }}
            />
          </div>
        );
      })}
    </>
  );
}

function formatBucket(start: number, end: number) {
  return `${formatCurrency(start)} to ${formatCurrency(end)}`;
}

function formatCompactBucket(start: number, end: number) {
  return `${formatCompactCurrency(start)}-${formatCompactCurrency(end)}`;
}

function formatCompactCurrency(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1000) {
    return `${sign}$${formatNumber(abs / 1000, 1)}k`;
  }

  return `${sign}$${formatNumber(abs, 0)}`;
}

function MetricBarComparison({ runs }: { runs: ComparisonRun[] }) {
  const metrics = [
    {
      label: "Net PnL",
      getValue: (run: ComparisonRun) => run.netProfit,
      format: formatCurrency,
      higherIsBetter: true,
    },
    {
      label: "Drawdown",
      getValue: (run: ComparisonRun) => Math.abs(run.maxDrawdown),
      format: (value: number) => formatCurrency(-value),
      higherIsBetter: false,
    },
    {
      label: "Win rate",
      getValue: (run: ComparisonRun) => run.winRate,
      format: formatPercent,
      higherIsBetter: true,
    },
    {
      label: "Profit factor",
      getValue: (run: ComparisonRun) => run.profitFactor ?? 0,
      format: formatNumber,
      higherIsBetter: true,
    },
    {
      label: "Expectancy",
      getValue: (run: ComparisonRun) => run.expectancy,
      format: formatCurrency,
      higherIsBetter: true,
    },
    {
      label: "Trades",
      getValue: (run: ComparisonRun) => run.tradeCount,
      format: (value: number) => formatNumber(value, 0),
      higherIsBetter: true,
    },
  ];

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Core metric bars</h2>
          <p>
            Fast read on headline quality before checking distribution shape.
          </p>
        </div>
        <SlidersHorizontal aria-hidden className="quiet-text" size={20} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {metrics.map((metric) => {
          const values = runs.map(metric.getValue);
          const max = Math.max(...values.map(Math.abs), 1);

          return (
            <div className="subtle-card p-4" key={metric.label}>
              <div className="chart-heading">
                <span>{metric.label}</span>
              </div>
              <div className="grid gap-2">
                {runs.map((run) => {
                  const value = metric.getValue(run);
                  const width = Math.max((Math.abs(value) / max) * 100, 2);

                  return (
                    <div className="grid gap-1" key={run.id}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Link
                          className="link-text font-semibold"
                          href={`/runs/${run.id}`}
                        >
                          {run.name}
                        </Link>
                        <span
                          className={
                            metric.higherIsBetter ? toneClass(value) : ""
                          }
                        >
                          {metric.format(value)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                        <div
                          className={
                            value >= 0
                              ? "h-full rounded-full bg-teal-300"
                              : "h-full rounded-full bg-rose-400"
                          }
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DailyOverlayChart({
  days,
  goldenName,
  candidateName,
}: {
  days: ReturnType<typeof filterAlignedDays>;
  goldenName: string;
  candidateName: string;
}) {
  const maxAbs = Math.max(
    ...days.flatMap((day) => [
      Math.abs(day.goldenPnl),
      Math.abs(day.candidatePnl),
    ]),
    1,
  );

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-amber-400" />
          {goldenName}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-teal-300" />
          {candidateName}
        </span>
      </div>
      <div className="flex h-72 items-center gap-1 overflow-x-auto border-y border-slate-800 py-4">
        {days.map((day) => {
          const goldenHeight = Math.max(
            (Math.abs(day.goldenPnl) / maxAbs) * 120,
            2,
          );
          const candidateHeight = Math.max(
            (Math.abs(day.candidatePnl) / maxAbs) * 120,
            2,
          );

          return (
            <div
              className="grid min-w-6 grid-cols-2 items-center gap-px"
              key={day.tradingDate}
              title={`${day.tradingDate}: golden ${formatCurrency(day.goldenPnl)}, candidate ${formatCurrency(day.candidatePnl)}, delta ${formatCurrency(day.delta)}`}
            >
              <Bar value={day.goldenPnl} height={goldenHeight} tone="gold" />
              <Bar
                value={day.candidatePnl}
                height={candidateHeight}
                tone="teal"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Bar({
  value,
  height,
  tone,
}: {
  value: number;
  height: number;
  tone: "gold" | "teal";
}) {
  return (
    <div className="relative h-64 w-full">
      <div className="absolute top-1/2 h-px w-full bg-slate-700/70" />
      <div
        className={
          value >= 0
            ? `absolute bottom-1/2 w-full rounded-t-sm ${tone === "gold" ? "bg-amber-400" : "bg-teal-300"}`
            : `absolute top-1/2 w-full rounded-b-sm ${tone === "gold" ? "bg-amber-700" : "bg-rose-400"}`
        }
        style={{ height }}
      />
    </div>
  );
}

function DistributionPanel({
  runs,
  title,
  valueType,
}: {
  runs: ComparisonRun[];
  title: string;
  valueType: "trade" | "daily";
}) {
  const series = runs.map((run) => ({
    run,
    values:
      valueType === "trade"
        ? run.tradePnls
        : run.dailyMetrics.map((day) => day.netProfit),
  }));
  const allValues = series.flatMap((item) => item.values);
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const span = max - min || 1;

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <p>Box plot plus strip plot, outliers included.</p>
        </div>
        <CircleDot aria-hidden className="quiet-text" size={20} />
      </div>
      <div className="grid gap-5">
        {series.map(({ run, values }) => (
          <BoxPlotRow
            key={`${valueType}-${run.id}`}
            max={max}
            min={min}
            run={run}
            span={span}
            values={values}
          />
        ))}
      </div>
    </section>
  );
}

function BoxPlotRow({
  run,
  values,
  min,
  span,
}: {
  run: ComparisonRun;
  values: number[];
  min: number;
  max: number;
  span: number;
}) {
  const summary = summarizeDistribution(values);
  const scale = (value: number) => ((value - min) / span) * 100;

  return (
    <div className="subtle-card p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Link className="link-text font-semibold" href={`/runs/${run.id}`}>
          {run.name}
        </Link>
        <div className="quiet-text flex flex-wrap gap-3 text-xs">
          <span>Median {formatCurrency(summary.median)}</span>
          <span>IQR {formatCurrency(summary.iqr)}</span>
          <span>Outliers {summary.outlierCount}</span>
        </div>
      </div>
      <div className="relative h-16 rounded-md border border-slate-800 bg-slate-950/50">
        <div className="absolute left-0 top-1/2 h-px w-full bg-slate-700" />
        <div
          className="absolute top-1/2 h-px bg-slate-300"
          style={{
            left: `${scale(summary.lowerWhisker)}%`,
            width: `${scale(summary.upperWhisker) - scale(summary.lowerWhisker)}%`,
          }}
        />
        <div
          className="absolute top-4 h-8 rounded-sm border border-amber-300/70 bg-amber-400/20"
          style={{
            left: `${scale(summary.q1)}%`,
            width: `${Math.max(scale(summary.q3) - scale(summary.q1), 1)}%`,
          }}
        />
        <div
          className="absolute top-3 h-10 w-px bg-amber-200"
          style={{ left: `${scale(summary.median)}%` }}
        />
        {values.slice(0, 240).map((value, index) => (
          <span
            className="absolute size-1.5 rounded-full bg-teal-300/70"
            key={`${run.id}-${value}-${index}`}
            style={{
              left: `${scale(value)}%`,
              top: `${10 + ((index * 17) % 44)}px`,
            }}
            title={formatCurrency(value)}
          />
        ))}
      </div>
    </div>
  );
}

function DailyDifferenceTable({
  days,
}: {
  days: ReturnType<typeof filterAlignedDays>;
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Golden</th>
            <th>Candidate</th>
            <th>Delta</th>
            <th>Golden trades</th>
            <th>Candidate trades</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.tradingDate}>
              <td>{day.tradingDate}</td>
              <td className={toneClass(day.goldenPnl)}>
                {formatCurrency(day.goldenPnl)}
              </td>
              <td className={toneClass(day.candidatePnl)}>
                {formatCurrency(day.candidatePnl)}
              </td>
              <td className={toneClass(day.delta)}>
                {formatCurrency(day.delta)}
              </td>
              <td>{day.goldenTrades}</td>
              <td>{day.candidateTrades}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
