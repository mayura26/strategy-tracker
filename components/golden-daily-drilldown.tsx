"use client";

import { BarChart3, ChevronDown, CircleDot } from "lucide-react";
import { useMemo, useState } from "react";

import type { DailyRunMetric } from "@/lib/analytics";
import {
  alignDailyPnL,
  buildHistogram,
  countSingleRunDays,
  type DayBucket,
  filterAlignedDays,
  sortAlignedDaysNewestFirst,
  summarizeOutcomes,
  summarizeOutperformance,
} from "@/lib/comparison-analytics";
import { formatCurrency, formatNumber, toneClass } from "@/lib/format";

const dayBuckets: Array<{ value: DayBucket; label: string }> = [
  { value: "all", label: "All" },
  { value: "candidate-wins", label: "This run beats" },
  { value: "golden-wins", label: "Golden beats" },
  { value: "both-win", label: "Both win" },
  { value: "both-loss", label: "Both loss" },
  { value: "disagreement", label: "Disagree" },
];

type Coverage = {
  start: string | null;
  end: string | null;
};

export function GoldenDailyDrilldown({
  currentName,
  currentDays,
  currentCoverage,
  goldenName,
  goldenDays,
  goldenCoverage,
}: {
  currentName: string;
  currentDays: DailyRunMetric[];
  currentCoverage: Coverage;
  goldenName: string;
  goldenDays: DailyRunMetric[];
  goldenCoverage: Coverage;
}) {
  const [bucket, setBucket] = useState<DayBucket>("all");
  const [hideSimilar, setHideSimilar] = useState(true);
  const [similarThreshold, setSimilarThreshold] = useState(50);
  const [materialThreshold, setMaterialThreshold] = useState(100);
  const [tableOpen, setTableOpen] = useState(false);
  const alignedDays = useMemo(
    () => alignDailyPnL(goldenDays, currentDays, "overlap"),
    [goldenDays, currentDays],
  );
  const unionDays = useMemo(
    () => alignDailyPnL(goldenDays, currentDays, "union"),
    [goldenDays, currentDays],
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
  const tableRows = useMemo(
    () => sortAlignedDaysNewestFirst(filteredDays),
    [filteredDays],
  );
  const currentOutcome = summarizeOutcomes(
    alignedDays.map((day) => day.candidatePnl),
  );
  const goldenOutcome = summarizeOutcomes(
    alignedDays.map((day) => day.goldenPnl),
  );
  const outperformance = summarizeOutperformance(
    alignedDays,
    materialThreshold,
  );
  const totalDelta = alignedDays.reduce((sum, day) => sum + day.delta, 0);
  const comparedRange = formatComparedRange(alignedDays);
  const goldenOnlyDays = countSingleRunDays(unionDays, "golden");
  const currentOnlyDays = countSingleRunDays(unionDays, "candidate");

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Golden daily drilldown</h2>
          <p>
            {filteredDays.length} of {alignedDays.length} shared trading days
            shown vs {goldenName}.
          </p>
        </div>
        <BarChart3 aria-hidden className="quiet-text" size={20} />
      </div>

      <div className="mb-5 flex flex-wrap gap-2 text-xs font-semibold">
        <CoverageChip
          label="This run"
          tone="candidate"
          value={currentCoverage}
        />
        <CoverageChip label="Golden" tone="golden" value={goldenCoverage} />
        <span className="rounded-sm border border-teal-400/25 bg-teal-400/10 px-2 py-1 text-teal-200">
          Compared {comparedRange}
        </span>
        <span className="rounded-sm border border-slate-500/30 bg-slate-500/10 px-2 py-1 text-slate-300">
          Excluded {goldenOnlyDays} golden-only / {currentOnlyDays} this-only
        </span>
      </div>

      <div className="metric-grid">
        <Metric
          label="Total delta"
          tone={totalDelta}
          value={formatCurrency(totalDelta)}
        />
        <Metric
          label="This beats"
          tone={outperformance.candidateBeats}
          value={String(outperformance.candidateBeats)}
        />
        <Metric
          label="Golden beats"
          tone={-outperformance.goldenBeats}
          value={String(outperformance.goldenBeats)}
        />
        <Metric
          label={`This >= ${formatCurrency(materialThreshold)}`}
          tone={outperformance.candidateThresholdBeats}
          value={String(outperformance.candidateThresholdBeats)}
        />
        <Metric
          label={`Golden >= ${formatCurrency(materialThreshold)}`}
          tone={-outperformance.goldenThresholdBeats}
          value={String(outperformance.goldenThresholdBeats)}
        />
        <Metric
          label="Biggest split"
          tone={
            (outperformance.biggestCandidateBeat ?? 0) >=
            (outperformance.biggestGoldenBeat ?? 0)
              ? 1
              : -1
          }
          value={`${formatCurrency(outperformance.biggestCandidateBeat)} / ${formatCurrency(outperformance.biggestGoldenBeat)}`}
        />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_170px_170px_170px]">
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
          <span className="label-text">Similarity</span>
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
        <label className="grid gap-2">
          <span className="label-text">Material delta</span>
          <input
            className="input"
            min="0"
            onChange={(event) =>
              setMaterialThreshold(Number(event.target.value))
            }
            step="25"
            type="number"
            value={materialThreshold}
          />
        </label>
        <label className="flex items-end gap-3 pb-2">
          <input
            checked={hideSimilar}
            className="size-5 accent-amber-400"
            onChange={(event) => setHideSimilar(event.target.checked)}
            type="checkbox"
          />
          <span className="label-text pb-1">Hide similar</span>
        </label>
      </div>

      <DailyOverlayChart
        currentName={currentName}
        days={filteredDays}
        goldenName={goldenName}
      />

      <section className="mt-5 grid gap-4 xl:grid-cols-[340px_1fr]">
        <OutcomePanel
          currentName={currentName}
          currentOutcome={currentOutcome}
          goldenName={goldenName}
          goldenOutcome={goldenOutcome}
        />
        <DeltaHistogram days={filteredDays} />
      </section>

      <div className="mt-5">
        <button
          className="ghost-button w-full justify-between"
          onClick={() => setTableOpen((current) => !current)}
          type="button"
        >
          <span>Day detail table ({tableRows.length})</span>
          <ChevronDown
            aria-hidden
            className={tableOpen ? "rotate-180 transition" : "transition"}
            size={18}
          />
        </button>
        {tableOpen ? <DayDetailTable days={tableRows} /> : null}
      </div>
    </section>
  );
}

function CoverageChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: Coverage;
  tone: "candidate" | "golden";
}) {
  const toneClassName =
    tone === "candidate"
      ? "border-sky-400/25 bg-sky-400/10 text-sky-200"
      : "border-amber-400/25 bg-amber-400/10 text-amber-200";

  return (
    <span className={`rounded-sm border px-2 py-1 ${toneClassName}`}>
      {label} {formatCoverage(value)}
    </span>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number | null;
}) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong
        className={tone === undefined || tone === null ? "" : toneClass(tone)}
      >
        {value}
      </strong>
    </div>
  );
}

function DailyOverlayChart({
  days,
  goldenName,
  currentName,
}: {
  days: ReturnType<typeof filterAlignedDays>;
  goldenName: string;
  currentName: string;
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
          {currentName}
        </span>
      </div>
      {days.length === 0 ? (
        <div className="grid h-64 place-items-center border-y border-slate-800 text-center">
          <p className="quiet-text text-sm">
            No days match the current filters.
          </p>
        </div>
      ) : (
        <div
          className="grid h-72 items-center gap-1 overflow-hidden border-y border-slate-800 py-4"
          style={{
            gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
          }}
        >
          {days.map((day) => {
            const goldenHeight = Math.max(
              (Math.abs(day.goldenPnl) / maxAbs) * 120,
              2,
            );
            const currentHeight = Math.max(
              (Math.abs(day.candidatePnl) / maxAbs) * 120,
              2,
            );

            return (
              <div
                className="grid min-w-0 grid-cols-2 items-center gap-px"
                key={day.tradingDate}
                title={`${day.tradingDate}: golden ${formatCurrency(day.goldenPnl)}, this run ${formatCurrency(day.candidatePnl)}, delta ${formatCurrency(day.delta)}`}
              >
                <PnlBar
                  height={goldenHeight}
                  tone="gold"
                  value={day.goldenPnl}
                />
                <PnlBar
                  height={currentHeight}
                  tone="teal"
                  value={day.candidatePnl}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PnlBar({
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

function OutcomePanel({
  currentName,
  goldenName,
  currentOutcome,
  goldenOutcome,
}: {
  currentName: string;
  goldenName: string;
  currentOutcome: ReturnType<typeof summarizeOutcomes>;
  goldenOutcome: ReturnType<typeof summarizeOutcomes>;
}) {
  return (
    <div className="subtle-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="strong-text text-sm font-bold">Green / red days</h3>
          <p className="quiet-text text-xs">Overlap period only.</p>
        </div>
        <CircleDot aria-hidden className="quiet-text" size={18} />
      </div>
      <div className="grid gap-5">
        <OutcomeRow name={currentName} summary={currentOutcome} tone="teal" />
        <OutcomeRow name={goldenName} summary={goldenOutcome} tone="gold" />
      </div>
    </div>
  );
}

function OutcomeRow({
  name,
  summary,
  tone,
}: {
  name: string;
  summary: ReturnType<typeof summarizeOutcomes>;
  tone: "teal" | "gold";
}) {
  const totalDays = summary.greenDays + summary.redDays + summary.flatDays || 1;
  const greenWidth = (summary.greenDays / totalDays) * 100;
  const redWidth = (summary.redDays / totalDays) * 100;
  const flatWidth = Math.max(100 - greenWidth - redWidth, 0);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span
          className={
            tone === "teal"
              ? "truncate font-semibold text-teal-200"
              : "truncate font-semibold text-amber-200"
          }
          title={name}
        >
          {name}
        </span>
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
      <div className="quiet-text grid grid-cols-3 gap-2 text-xs">
        <span>Green {summary.greenDays}</span>
        <span>Red {summary.redDays}</span>
        <span>Flat {summary.flatDays}</span>
      </div>
      <p className="quiet-text text-xs">
        Best {formatCurrency(summary.bestDay)} / worst{" "}
        {formatCurrency(summary.worstDay)}
      </p>
    </div>
  );
}

function DeltaHistogram({
  days,
}: {
  days: ReturnType<typeof filterAlignedDays>;
}) {
  const bins = buildHistogram(
    days.map((day) => day.delta),
    10,
  );
  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);

  return (
    <div className="subtle-card p-4">
      <div className="mb-3">
        <h3 className="strong-text text-sm font-bold">Delta distribution</h3>
        <p className="quiet-text text-xs">
          Positive means this run beat golden.
        </p>
      </div>
      {bins.length === 0 ? (
        <div className="grid h-44 place-items-center text-center">
          <p className="quiet-text text-sm">No deltas to plot.</p>
        </div>
      ) : (
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${bins.length}, minmax(0, 1fr))`,
          }}
        >
          {bins.map((bin) => (
            <div
              className="quiet-text flex min-h-9 items-end justify-center text-center text-[0.6rem] leading-tight"
              key={`${bin.start}-${bin.end}-label`}
              title={formatBucket(bin.start, bin.end)}
            >
              {formatCompactBucket(bin.start, bin.end)}
            </div>
          ))}
          {bins.map((bin) => {
            const height = Math.max(
              (bin.count / maxCount) * 100,
              bin.count ? 7 : 0,
            );
            const tone =
              bin.end <= 0
                ? "bg-amber-500"
                : bin.start < 0 && bin.end > 0
                  ? "bg-slate-500"
                  : "bg-teal-300";

            return (
              <div
                className="flex h-36 items-end border-b border-slate-800"
                key={`${bin.start}-${bin.end}`}
                title={`${formatBucket(bin.start, bin.end)}: ${bin.count} days`}
              >
                <div
                  className={`w-full rounded-t-sm ${tone}`}
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DayDetailTable({
  days,
}: {
  days: ReturnType<typeof filterAlignedDays>;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>This run</th>
            <th>Golden</th>
            <th>Delta</th>
            <th>This trades</th>
            <th>Golden trades</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.tradingDate}>
              <td>{day.tradingDate}</td>
              <td className={toneClass(day.candidatePnl)}>
                {formatCurrency(day.candidatePnl)}
              </td>
              <td className={toneClass(day.goldenPnl)}>
                {formatCurrency(day.goldenPnl)}
              </td>
              <td className={toneClass(day.delta)}>
                {formatCurrency(day.delta)}
              </td>
              <td>{day.candidateTrades}</td>
              <td>{day.goldenTrades}</td>
              <td>{winnerLabel(day.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function winnerLabel(delta: number) {
  if (delta > 0) {
    return <span className="text-teal-200">This run</span>;
  }

  if (delta < 0) {
    return <span className="text-amber-200">Golden</span>;
  }

  return <span className="quiet-text">Tie</span>;
}

function formatComparedRange(days: ReturnType<typeof alignDailyPnL>) {
  if (days.length === 0) {
    return "n/a";
  }

  return `${days[0].tradingDate} to ${days.at(-1)?.tradingDate}`;
}

function formatCoverage(value: Coverage) {
  if (!value.start || !value.end) {
    return "n/a";
  }

  return `${value.start} to ${value.end}`;
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
