"use client";

import {
  BarChart3,
  ChevronDown,
  CircleDot,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  type AlignmentMode,
  alignDailyPnL,
  buildHistogram,
  type DayBucket,
  filterAlignedDays,
  summarizeDistribution,
  summarizeOutcomes,
  summarizeOutperformance,
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
  const [outperformanceThreshold, setOutperformanceThreshold] = useState(100);
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>("overlap");
  const candidate =
    group?.runs.find((run) => run.id === candidateIdByGroup[group.scope]) ??
    group?.runs.find((run) => run.id !== golden?.id) ??
    golden;
  const alignedDays = useMemo(
    () =>
      golden && candidate
        ? alignDailyPnL(
            golden.dailyMetrics,
            candidate.dailyMetrics,
            alignmentMode,
          )
        : [],
    [golden, candidate, alignmentMode],
  );
  const unionAlignedDays = useMemo(
    () =>
      golden && candidate
        ? alignDailyPnL(golden.dailyMetrics, candidate.dailyMetrics, "union")
        : [],
    [golden, candidate],
  );
  const scopedRuns = useMemo(
    () =>
      golden && candidate
        ? buildScopedDailyRuns(golden, candidate, alignedDays)
        : [],
    [golden, candidate, alignedDays],
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
          <span className="quiet-text text-xs">{formatCoverage(golden)}</span>
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
                {run.name} ({formatCoverage(run)})
              </option>
            ))}
          </select>
          <span className="quiet-text text-xs">
            {formatCoverage(candidate)}
          </span>
        </label>
      </section>

      <section className="panel grid gap-4 lg:grid-cols-[1fr_260px]">
        <div>
          <h2 className="strong-text text-base font-bold">Comparison period</h2>
          <p className="quiet-text mt-1 text-sm">
            {alignmentMode === "overlap"
              ? `${alignedDays.length} shared trading days are included. ${countSingleRunDays(unionAlignedDays, "golden")} golden-only and ${countSingleRunDays(unionAlignedDays, "candidate")} candidate-only days are excluded.`
              : `${alignedDays.length} union trading days are included, with missing run days treated as zero PnL.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-sm border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-amber-200">
              Golden {formatCoverage(golden)}
            </span>
            <span className="rounded-sm border border-sky-400/25 bg-sky-400/10 px-2 py-1 text-sky-200">
              Candidate {formatCoverage(candidate)}
            </span>
            <span className="rounded-sm border border-teal-400/25 bg-teal-400/10 px-2 py-1 text-teal-200">
              Compared {formatAlignedRange(alignedDays)}
            </span>
          </div>
        </div>
        <label className="grid gap-2">
          <span className="label-text">Date handling</span>
          <select
            className="input"
            onChange={(event) =>
              setAlignmentMode(event.target.value as AlignmentMode)
            }
            value={alignmentMode}
          >
            <option value="overlap">Overlap only</option>
            <option value="union">Union, missing as zero</option>
          </select>
        </label>
      </section>

      <MetricBarComparison runs={group.runs} />

      <OutperformanceVersus
        candidateName={candidate.name}
        days={alignedDays}
        goldenName={golden.name}
        onThresholdChange={setOutperformanceThreshold}
        threshold={outperformanceThreshold}
      />

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
        <DayOutcomeVersus runs={scopedRuns} />
        <DailyHistogramComparison runs={scopedRuns} />
      </section>

      <DistributionPanel runs={scopedRuns} title="Daily PnL distribution" />
    </div>
  );
}

function buildScopedDailyRuns(
  golden: ComparisonRun,
  candidate: ComparisonRun,
  days: ReturnType<typeof alignDailyPnL>,
): ComparisonRun[] {
  return [
    {
      ...golden,
      dailyMetrics: days.map((day) =>
        dailyMetricFromAligned(
          day.tradingDate,
          day.goldenPnl,
          day.goldenTrades,
        ),
      ),
    },
    {
      ...candidate,
      dailyMetrics: days.map((day) =>
        dailyMetricFromAligned(
          day.tradingDate,
          day.candidatePnl,
          day.candidateTrades,
        ),
      ),
    },
  ];
}

function dailyMetricFromAligned(
  tradingDate: string,
  netProfit: number,
  tradeCount: number,
) {
  return {
    tradingDate,
    tradeCount,
    netProfit,
    cumulativeNetProfit: netProfit,
    winCount: netProfit > 0 ? 1 : 0,
    lossCount: netProfit < 0 ? 1 : 0,
    maxDrawdown: Math.min(netProfit, 0),
    bestTrade: netProfit,
    worstTrade: netProfit,
    avgMae: null,
    avgMfe: null,
  };
}

function formatCoverage(run: {
  coverageStartDate: string | null;
  coverageEndDate: string | null;
}) {
  if (!run.coverageStartDate || !run.coverageEndDate) {
    return "n/a";
  }

  return `${run.coverageStartDate} to ${run.coverageEndDate}`;
}

function formatAlignedRange(days: ReturnType<typeof alignDailyPnL>) {
  if (days.length === 0) {
    return "n/a";
  }

  return `${days[0].tradingDate} to ${days.at(-1)?.tradingDate}`;
}

function countSingleRunDays(
  days: ReturnType<typeof alignDailyPnL>,
  side: "golden" | "candidate",
) {
  return days.filter((day) =>
    side === "golden"
      ? day.goldenTrades > 0 && day.candidateTrades === 0
      : day.candidateTrades > 0 && day.goldenTrades === 0,
  ).length;
}

function OutperformanceVersus({
  days,
  goldenName,
  candidateName,
  threshold,
  onThresholdChange,
}: {
  days: ReturnType<typeof alignDailyPnL>;
  goldenName: string;
  candidateName: string;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
}) {
  const summary = summarizeOutperformance(days, threshold);
  const thresholdDays = days
    .filter((day) => Math.abs(day.delta) >= summary.threshold)
    .sort((left, right) => right.tradingDate.localeCompare(left.tradingDate))
    .slice(0, 16);

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Outperformance vs</h2>
          <p>
            Counts days where one run beat the other, plus material-delta days.
          </p>
        </div>
        <label className="grid min-w-44 gap-2">
          <span className="label-text">Material delta</span>
          <input
            className="input"
            min="0"
            onChange={(event) =>
              onThresholdChange(Number(event.target.value) || 0)
            }
            step="25"
            type="number"
            value={threshold}
          />
        </label>
      </div>
      <div className="metric-grid">
        <VersusMetric
          label={`${candidateName} beat days`}
          tone="candidate"
          value={`${summary.candidateBeats} / ${summary.totalDays}`}
        />
        <VersusMetric
          label={`${goldenName} beat days`}
          tone="golden"
          value={`${summary.goldenBeats} / ${summary.totalDays}`}
        />
        <Metric label="Tied days" value={String(summary.tiedDays)} />
        <VersusMetric
          label={`${candidateName} >= ${formatCurrency(summary.threshold)}`}
          tone="candidate"
          value={String(summary.candidateThresholdBeats)}
        />
        <VersusMetric
          label={`${goldenName} >= ${formatCurrency(summary.threshold)}`}
          tone="golden"
          value={String(summary.goldenThresholdBeats)}
        />
        <Metric
          label="Biggest spread"
          value={formatCurrency(
            Math.max(
              summary.biggestCandidateBeat ?? 0,
              summary.biggestGoldenBeat ?? 0,
            ),
          )}
        />
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Winner</th>
              <th>Golden</th>
              <th>Candidate</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {thresholdDays.map((day) => {
              const candidateWon = day.delta > 0;

              return (
                <tr
                  className={candidateWon ? "bg-sky-400/5" : "bg-amber-400/5"}
                  key={day.tradingDate}
                >
                  <td>{day.tradingDate}</td>
                  <td>
                    <span
                      className={
                        candidateWon
                          ? "rounded-sm bg-sky-400/15 px-2 py-1 font-semibold text-sky-200"
                          : "rounded-sm bg-amber-400/15 px-2 py-1 font-semibold text-amber-200"
                      }
                    >
                      {candidateWon ? candidateName : goldenName}
                    </span>
                  </td>
                  <td className={toneClass(day.goldenPnl)}>
                    {formatCurrency(day.goldenPnl)}
                  </td>
                  <td className={toneClass(day.candidatePnl)}>
                    {formatCurrency(day.candidatePnl)}
                  </td>
                  <td
                    className={
                      candidateWon
                        ? "font-semibold text-sky-300"
                        : "font-semibold text-amber-300"
                    }
                  >
                    {formatCurrency(day.delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VersusMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "candidate" | "golden";
}) {
  return (
    <div
      className={
        tone === "candidate"
          ? "mini-metric border-sky-400/25 bg-sky-400/10"
          : "mini-metric border-amber-400/25 bg-amber-400/10"
      }
    >
      <span>{label}</span>
      <strong
        className={tone === "candidate" ? "text-sky-200" : "text-amber-200"}
      >
        {value}
      </strong>
    </div>
  );
}

function DayOutcomeVersus({ runs }: { runs: ComparisonRun[] }) {
  const rows = runs.map((run) => ({
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

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number;
}) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong className={tone === undefined ? "" : toneClass(tone)}>
        {value}
      </strong>
    </div>
  );
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
      <div
        className="grid h-72 items-center gap-1 overflow-hidden border-y border-slate-800 py-4"
        style={{
          gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))`,
        }}
      >
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
              className="grid min-w-0 grid-cols-2 items-center gap-px"
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
}: {
  runs: ComparisonRun[];
  title: string;
}) {
  const series = runs.map((run) => ({
    run,
    values: run.dailyMetrics.map((day) => day.netProfit),
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
            key={`daily-${run.id}`}
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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <button
        aria-expanded={isOpen}
        className="ghost-button w-full justify-between"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>Daily difference table ({days.length})</span>
        <ChevronDown
          aria-hidden
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          size={16}
        />
      </button>
      {isOpen ? (
        <div className="mt-4 overflow-x-auto">
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
      ) : null}
    </div>
  );
}
