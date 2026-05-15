"use client";

import {
  BarChart3,
  ChevronDown,
  CircleDot,
  Download,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { deleteSwitchRuleAction, saveSwitchRuleAction } from "@/app/actions";
import {
  type AlignedDay,
  type AlignmentMode,
  alignDailyPnL,
  buildHistogram,
  type DayBucket,
  discoverModeSwitchRules,
  evaluateModeSwitchRule,
  filterAlignedDays,
  labelForSwitchFeature,
  type ModeSwitchCandidate,
  type ModeSwitchDay,
  type ModeSwitchFeature,
  type ModeSwitchMetrics,
  type ModeSwitchOperator,
  summarizeDistribution,
  summarizeOutcomes,
  summarizeOutperformance,
} from "@/lib/comparison-analytics";
import type {
  AnalysisSettings,
  ComparisonGroup,
  ComparisonRun,
  SavedSwitchRule,
} from "@/lib/db/repository";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  toneClass,
} from "@/lib/format";

const dayBuckets: Array<{ value: DayBucket; label: string }> = [
  { value: "all", label: "All" },
  { value: "candidate-wins", label: "Mode B beats" },
  { value: "golden-wins", label: "Mode A beats" },
  { value: "both-win", label: "Both win" },
  { value: "both-loss", label: "Both loss" },
  { value: "disagreement", label: "Disagree" },
];

export function ComparisonWorkbench({
  groups,
  analysisSettings,
}: {
  groups: ComparisonGroup[];
  analysisSettings: AnalysisSettings;
}) {
  const [groupIndex, setGroupIndex] = useState(0);
  const group = groups[groupIndex] ?? groups[0];
  const defaultModeA =
    group?.runs.find((run) => run.isGolden) ?? group?.runs[0];
  const [modeAIdByGroup, setModeAIdByGroup] = useState<Record<string, string>>(
    {},
  );
  const [modeBIdByGroup, setModeBIdByGroup] = useState<Record<string, string>>(
    {},
  );
  const [bucket, setBucket] = useState<DayBucket>("all");
  const [hideSimilar, setHideSimilar] = useState(true);
  const [similarThreshold, setSimilarThreshold] = useState(50);
  const [outperformanceThreshold, setOutperformanceThreshold] = useState(100);
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>("overlap");
  const groupScope = group?.scope ?? "";
  const golden =
    group?.runs.find((run) => run.id === modeAIdByGroup[groupScope]) ??
    defaultModeA;
  const candidate =
    group?.runs.find((run) => run.id === modeBIdByGroup[groupScope]) ??
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
          <span className="label-text">Mode A</span>
          <select
            className="input"
            onChange={(event) => {
              const nextModeAId = event.target.value;
              setModeAIdByGroup((current) => ({
                ...current,
                [group.scope]: nextModeAId,
              }));

              if (nextModeAId === candidate.id) {
                const nextModeB = group.runs.find(
                  (run) => run.id !== nextModeAId,
                );
                setModeBIdByGroup((current) => ({
                  ...current,
                  [group.scope]: nextModeB?.id ?? nextModeAId,
                }));
              }
            }}
            value={golden.id}
          >
            {group.runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.name} / {run.botModeName ?? "No mode"}
              </option>
            ))}
          </select>
          <span className="quiet-text text-xs">{formatCoverage(golden)}</span>
        </div>
        <label className="grid gap-2">
          <span className="label-text">Mode B</span>
          <select
            className="input"
            onChange={(event) =>
              setModeBIdByGroup((current) => ({
                ...current,
                [group.scope]: event.target.value,
              }))
            }
            value={candidate.id}
          >
            {group.runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.name} / {run.botModeName ?? "No mode"}
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
              ? `${alignedDays.length} shared trading days are included. ${countSingleRunDays(unionAlignedDays, "golden")} Mode A-only and ${countSingleRunDays(unionAlignedDays, "candidate")} Mode B-only days are excluded.`
              : `${alignedDays.length} union trading days are included, with missing run days treated as zero PnL.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-sm border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-amber-200">
              Mode A {formatCoverage(golden)}
            </span>
            <span className="rounded-sm border border-sky-400/25 bg-sky-400/10 px-2 py-1 text-sky-200">
              Mode B {formatCoverage(candidate)}
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

      <MetricBarComparison
        fullRuns={group.runs}
        periodLabel={
          alignmentMode === "overlap"
            ? "Selected overlap period"
            : "Selected union period"
        }
        periodRuns={scopedRuns}
      />

      <ModeSwitchLab
        analysisSettings={analysisSettings}
        group={group}
        marketBars={group.marketBars}
        modeA={golden}
        modeB={candidate}
      />

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
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="ghost-button min-h-10"
              onClick={() =>
                downloadAlignedDaysCsv({
                  candidateName: candidate.name,
                  days: filteredDays,
                  fileName: csvFileName(
                    "daily-deltas",
                    golden.name,
                    candidate.name,
                  ),
                  goldenName: golden.name,
                })
              }
              type="button"
            >
              <Download aria-hidden size={15} />
              Export shown
            </button>
            <BarChart3 aria-hidden className="quiet-text" size={20} />
          </div>
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
    buildPeriodComparisonRun(golden, days, "golden"),
    buildPeriodComparisonRun(candidate, days, "candidate"),
  ];
}

function buildPeriodComparisonRun(
  run: ComparisonRun,
  days: AlignedDay[],
  side: "golden" | "candidate",
): ComparisonRun {
  const dailyMetrics = days.map((day) =>
    dailyMetricFromAligned(
      day.tradingDate,
      side === "golden" ? day.goldenPnl : day.candidatePnl,
      side === "golden" ? day.goldenTrades : day.candidateTrades,
    ),
  );
  const values = dailyMetrics.map((day) => day.netProfit);
  const netProfit = values.reduce((sum, value) => sum + value, 0);
  const positiveValues = values.filter((value) => value > 0);
  const negativeValues = values.filter((value) => value < 0);
  const grossProfit = positiveValues.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(
    negativeValues.reduce((sum, value) => sum + value, 0),
  );

  return {
    ...run,
    dailyMetrics,
    expectancy: values.length === 0 ? 0 : netProfit / values.length,
    maxDrawdown: calculateDailyDrawdown(values),
    netProfit,
    profitFactor:
      grossLoss === 0 ? (grossProfit > 0 ? null : 0) : grossProfit / grossLoss,
    tradeCount: dailyMetrics.length,
    winRate: values.length === 0 ? 0 : positiveValues.length / values.length,
  };
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

function calculateDailyDrawdown(values: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }

  return maxDrawdown;
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

function ModeSwitchLab({
  modeA,
  modeB,
  group,
  marketBars,
  analysisSettings,
}: {
  modeA: ComparisonRun;
  modeB: ComparisonRun;
  group: ComparisonGroup;
  marketBars: ComparisonGroup["marketBars"];
  analysisSettings: AnalysisSettings;
}) {
  const [operator, setOperator] = useState<ModeSwitchOperator>("gt");
  const [feature, setFeature] = useState<ModeSwitchFeature>("previous-rsi");
  const [threshold, setThreshold] = useState(
    defaultDisplayThreshold("previous-rsi", analysisSettings),
  );
  const [ruleName, setRuleName] = useState("");
  const ruleThreshold = toRuleThreshold(feature, threshold);
  const evaluation = useMemo(
    () =>
      evaluateModeSwitchRule({
        marketBars,
        marketSessionFeatures: group.marketSessionFeatures,
        modeADays: modeA.dailyMetrics,
        modeBDays: modeB.dailyMetrics,
        rule: { feature, operator, threshold: ruleThreshold },
        settings: analysisSettings,
      }),
    [
      modeA,
      modeB,
      group.marketSessionFeatures,
      marketBars,
      analysisSettings,
      feature,
      operator,
      ruleThreshold,
    ],
  );
  const candidates = useMemo(
    () =>
      discoverModeSwitchRules({
        marketBars,
        marketSessionFeatures: group.marketSessionFeatures,
        modeADays: modeA.dailyMetrics,
        modeBDays: modeB.dailyMetrics,
        settings: analysisSettings,
      }),
    [modeA, modeB, group.marketSessionFeatures, marketBars, analysisSettings],
  );
  const featureLabel = labelForSwitchFeature(feature, analysisSettings);
  const ruleText = `${featureLabel} ${operatorLabel(operator)} ${formatSwitchThreshold(
    feature,
    ruleThreshold,
  )}`;
  const ruleJson = JSON.stringify({
    feature,
    indicator: feature,
    operator,
    threshold: ruleThreshold,
  });
  const metricsJson = JSON.stringify({
    modeAName: modeA.name,
    modeBName: modeB.name,
    ruleText,
    summary: evaluation.summary,
  });
  const savedRulesForPair = group.savedSwitchRules.filter(
    (rule) => rule.modeARunId === modeA.id && rule.modeBRunId === modeB.id,
  );

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Mode switch lab</h2>
          <p>
            {ruleText} routes to Mode A; otherwise Mode B. The unselected mode
            is treated as zero exposure.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[220px_120px_140px]">
          <label className="grid gap-1">
            <span className="label-text">Signal</span>
            <select
              className="input min-h-10"
              onChange={(event) => {
                const nextFeature = event.target.value as ModeSwitchFeature;
                setFeature(nextFeature);
                setThreshold(
                  defaultDisplayThreshold(nextFeature, analysisSettings),
                );
              }}
              value={feature}
            >
              {switchFeatureOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label(analysisSettings)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label-text">Condition</span>
            <select
              className="input min-h-10"
              onChange={(event) =>
                setOperator(event.target.value as ModeSwitchOperator)
              }
              value={operator}
            >
              <option value="gt">&gt;</option>
              <option value="gte">&gt;=</option>
              <option value="lt">&lt;</option>
              <option value="lte">&lt;=</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label-text">
              {isPercentSwitchFeature(feature) ? "Threshold %" : "Threshold"}
            </span>
            <input
              className="input min-h-10"
              min="0"
              onChange={(event) => setThreshold(Number(event.target.value))}
              step={isPercentSwitchFeature(feature) ? "0.01" : "1"}
              type="number"
              value={threshold}
            />
          </label>
        </div>
      </div>

      {evaluation.days.length === 0 ? (
        <div className="empty-state">
          Refresh market data, check RSI warmup, or choose runs with overlapping
          dates to unlock switch simulation.
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-sm border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-amber-200">
              Mode A: {modeA.name}
            </span>
            <span className="rounded-sm border border-sky-400/25 bg-sky-400/10 px-2 py-1 text-sky-200">
              Mode B: {modeB.name}
            </span>
            <span className="rounded-sm border border-teal-400/25 bg-teal-400/10 px-2 py-1 text-teal-200">
              {evaluation.summary.totalDays} routed days
            </span>
            <span className="rounded-sm border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">
              {evaluation.summary.excludedNoSignalDays} excluded for missing
              signal
            </span>
          </div>

          <div className="metric-grid">
            <Metric
              label="Switched PnL"
              tone={evaluation.summary.totalPnl}
              value={formatCurrency(evaluation.summary.totalPnl)}
            />
            <Metric
              label="Switched drawdown"
              tone={evaluation.summary.maxDrawdown}
              value={formatCurrency(evaluation.summary.maxDrawdown)}
            />
            <Metric
              label="Win day rate"
              value={formatPercent(evaluation.summary.winDayRate)}
            />
            <Metric
              label="Expectancy / day"
              tone={evaluation.summary.expectancy}
              value={formatCurrency(evaluation.summary.expectancy)}
            />
            <Metric
              label="Mode A / B days"
              value={`${evaluation.summary.modeADays} / ${evaluation.summary.modeBDays}`}
            />
            <Metric
              label="Green / red / flat"
              value={`${evaluation.summary.greenDays} / ${evaluation.summary.redDays} / ${evaluation.summary.flatDays}`}
            />
          </div>

          <SavedSwitchRulePanel
            group={group}
            metricsJson={metricsJson}
            modeA={modeA}
            modeB={modeB}
            ruleJson={ruleJson}
            ruleName={ruleName}
            savedRules={savedRulesForPair}
            setRuleName={setRuleName}
          />

          <SwitchCandidateStrip
            analysisSettings={analysisSettings}
            candidates={candidates}
            onApply={(candidate) => {
              const candidateFeature = candidate.rule.feature ?? "previous-rsi";
              setFeature(candidateFeature);
              setOperator(candidate.rule.operator);
              setThreshold(
                fromRuleThreshold(candidateFeature, candidate.rule.threshold),
              );
            }}
          />

          <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <SwitchOutcomeCard
              modeAName={modeA.name}
              modeBName={modeB.name}
              summary={evaluation.summary}
            />
            <SwitchEquityChart
              days={evaluation.days}
              modeAName={modeA.name}
              modeBName={modeB.name}
            />
          </section>

          <RoutedPnlChart
            days={evaluation.days}
            modeAName={modeA.name}
            modeBName={modeB.name}
          />
          <ModeSwitchDayTable
            days={evaluation.days}
            modeAName={modeA.name}
            modeBName={modeB.name}
          />
        </div>
      )}
    </section>
  );
}

function SwitchOutcomeCard({
  modeAName,
  modeBName,
  summary,
}: {
  modeAName: string;
  modeBName: string;
  summary: ReturnType<typeof evaluateModeSwitchRule>["summary"];
}) {
  return (
    <div className="subtle-card p-4">
      <div className="chart-heading">
        <span>Switch vs always run</span>
      </div>
      <div className="grid gap-3">
        <SwitchMetricRow label="Switch" metrics={summary} />
        <SwitchMetricRow label={modeAName} metrics={summary.alwaysA} />
        <SwitchMetricRow label={modeBName} metrics={summary.alwaysB} />
      </div>
      <div className="quiet-text mt-4 grid gap-1 text-xs">
        <span>
          Avoided losses: {modeAName} {summary.avoidedLossModeA}, {modeBName}{" "}
          {summary.avoidedLossModeB}
        </span>
        <span>
          Missed wins: {modeAName} {summary.missedWinModeA}, {modeBName}{" "}
          {summary.missedWinModeB}
        </span>
      </div>
    </div>
  );
}

function SavedSwitchRulePanel({
  group,
  modeA,
  modeB,
  ruleName,
  ruleJson,
  metricsJson,
  savedRules,
  setRuleName,
}: {
  group: ComparisonGroup;
  modeA: ComparisonRun;
  modeB: ComparisonRun;
  ruleName: string;
  ruleJson: string;
  metricsJson: string;
  savedRules: SavedSwitchRule[];
  setRuleName: (value: string) => void;
}) {
  return (
    <div className="subtle-card grid gap-4 p-4 xl:grid-cols-[1fr_1.2fr]">
      <form action={saveSwitchRuleAction} className="grid gap-3">
        <div className="chart-heading">
          <span>Save switch rule</span>
        </div>
        <input name="botId" type="hidden" value={group.botId} />
        <input name="instrumentId" type="hidden" value={group.instrumentId} />
        <input name="timeframe" type="hidden" value={group.timeframe} />
        <input name="modeARunId" type="hidden" value={modeA.id} />
        <input name="modeBRunId" type="hidden" value={modeB.id} />
        <input name="ruleJson" type="hidden" value={ruleJson} />
        <input name="metricsJson" type="hidden" value={metricsJson} />
        <label className="grid gap-2">
          <span className="label-text">Rule name</span>
          <input
            className="input"
            name="name"
            onChange={(event) => setRuleName(event.target.value)}
            placeholder={`${modeA.botModeName ?? "Mode A"} high-RSI router`}
            value={ruleName}
          />
        </label>
        <button className="primary-button w-fit" type="submit">
          <Save aria-hidden size={15} />
          Save rule
        </button>
      </form>
      <div>
        <div className="chart-heading">
          <span>Saved for this pair</span>
        </div>
        {savedRules.length === 0 ? (
          <p className="quiet-text text-sm">
            No saved switch rules for this exact Mode A / Mode B pair yet.
          </p>
        ) : (
          <div className="grid gap-2">
            {savedRules.map((rule) => (
              <SavedSwitchRuleRow key={rule.id} rule={rule} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SavedSwitchRuleRow({ rule }: { rule: SavedSwitchRule }) {
  const parsedRule = parseJson<{
    feature?: ModeSwitchFeature;
    operator?: ModeSwitchOperator;
    threshold?: number;
    rsiPeriod?: number;
  }>(rule.ruleJson);
  const metrics = parseJson<{
    ruleText?: string;
    summary?: { totalPnl?: number; winDayRate?: number; maxDrawdown?: number };
  }>(rule.metricsJson);

  return (
    <div className="rounded-sm border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="strong-text font-semibold">{rule.name}</p>
          <p className="quiet-text mt-1 text-xs">
            {metrics?.ruleText ??
              `${parsedRule?.feature ?? "previous-rsi"} ${operatorLabel(
                parsedRule?.operator ?? "gt",
              )} ${
                parsedRule?.threshold === undefined
                  ? "n/a"
                  : formatSwitchThreshold(
                      parsedRule.feature ?? "previous-rsi",
                      parsedRule.threshold,
                    )
              }`}
          </p>
        </div>
        <form action={deleteSwitchRuleAction}>
          <input name="switchRuleId" type="hidden" value={rule.id} />
          <button
            className="ghost-button min-h-8 px-2 text-rose-200"
            title="Delete saved switch rule"
            type="submit"
          >
            <Trash2 aria-hidden size={14} />
          </button>
        </form>
      </div>
      <div className="quiet-text mt-3 grid grid-cols-3 gap-2 text-xs">
        <span className={toneClass(metrics?.summary?.totalPnl)}>
          {formatCurrency(metrics?.summary?.totalPnl)}
        </span>
        <span>Win {formatPercent(metrics?.summary?.winDayRate)}</span>
        <span>DD {formatCurrency(metrics?.summary?.maxDrawdown)}</span>
      </div>
    </div>
  );
}

function SwitchCandidateStrip({
  candidates,
  analysisSettings,
  onApply,
}: {
  candidates: ModeSwitchCandidate[];
  analysisSettings: AnalysisSettings;
  onApply: (candidate: ModeSwitchCandidate) => void;
}) {
  return (
    <div className="subtle-card p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="chart-heading">
          <span>RSI rule scan</span>
        </div>
        <p className="quiet-text text-xs">
          Ranked by improvement over the better always-run mode.
        </p>
      </div>
      {candidates.length === 0 ? (
        <p className="quiet-text text-sm">
          No switch rule had enough routed days on both modes yet.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {candidates.slice(0, 6).map((candidate) => (
            <button
              className="rounded-sm border border-slate-800 bg-slate-950/45 p-3 text-left transition hover:border-sky-400/40 hover:bg-sky-400/10"
              key={`${candidate.rule.operator}-${candidate.rule.threshold}`}
              onClick={() => onApply(candidate)}
              type="button"
            >
              <span className="strong-text block font-semibold">
                {labelForSwitchFeature(
                  candidate.rule.feature ?? "previous-rsi",
                  analysisSettings,
                )}{" "}
                {operatorLabel(candidate.rule.operator)}{" "}
                {formatSwitchThreshold(
                  candidate.rule.feature ?? "previous-rsi",
                  candidate.rule.threshold,
                )}
              </span>
              <span className={toneClass(candidate.improvementVsBestAlways)}>
                {formatCurrency(candidate.improvementVsBestAlways)} vs best
                always
              </span>
              <span className="quiet-text mt-2 grid grid-cols-2 gap-2 text-xs">
                <span>
                  {formatCurrency(candidate.evaluation.summary.totalPnl)}
                </span>
                <span>
                  A/B {candidate.evaluation.summary.modeADays}/
                  {candidate.evaluation.summary.modeBDays}
                </span>
                <span>
                  Win {formatPercent(candidate.evaluation.summary.winDayRate)}
                </span>
                <span>
                  DD {formatCurrency(candidate.evaluation.summary.maxDrawdown)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SwitchMetricRow({
  label,
  metrics,
}: {
  label: string;
  metrics: ModeSwitchMetrics;
}) {
  return (
    <div className="rounded-sm border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="strong-text truncate font-semibold">{label}</span>
        <span className={toneClass(metrics.totalPnl)}>
          {formatCurrency(metrics.totalPnl)}
        </span>
      </div>
      <div className="quiet-text mt-2 grid grid-cols-2 gap-2 text-xs">
        <span>DD {formatCurrency(metrics.maxDrawdown)}</span>
        <span>Win {formatPercent(metrics.winDayRate)}</span>
        <span>Exp {formatCurrency(metrics.expectancy)}</span>
        <span>
          {metrics.greenDays}/{metrics.redDays}/{metrics.flatDays}
        </span>
      </div>
    </div>
  );
}

function RoutedPnlChart({
  days,
  modeAName,
  modeBName,
}: {
  days: ModeSwitchDay[];
  modeAName: string;
  modeBName: string;
}) {
  const maxAbs = Math.max(...days.map((day) => Math.abs(day.switchedPnl)), 1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap justify-between gap-3">
        <div className="chart-heading">
          <span>Routed daily PnL</span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded-sm bg-amber-400" />
            {modeAName}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded-sm bg-sky-300" />
            {modeBName}
          </span>
        </div>
      </div>
      <div
        className="grid h-60 items-center gap-1 overflow-hidden border-y border-slate-800 py-4"
        style={{
          gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {days.map((day) => {
          const height = Math.max(
            (Math.abs(day.switchedPnl) / maxAbs) * 104,
            2,
          );
          return (
            <div
              className="relative h-52 min-w-0"
              key={day.tradingDate}
              title={`${day.tradingDate}: ${day.signalLabel} ${formatNumber(day.signalValue)}, ${day.selectedMode === "mode-a" ? modeAName : modeBName} ${formatCurrency(day.switchedPnl)}`}
            >
              <div className="absolute top-1/2 h-px w-full bg-slate-700/70" />
              <div
                className={routedBarClass(day)}
                style={{
                  height,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function routedBarClass(day: ModeSwitchDay) {
  const color =
    day.selectedMode === "mode-a"
      ? day.switchedPnl >= 0
        ? "bg-amber-400"
        : "bg-amber-700"
      : day.switchedPnl >= 0
        ? "bg-sky-300"
        : "bg-rose-400";
  return day.switchedPnl >= 0
    ? `absolute bottom-1/2 w-full rounded-t-sm ${color}`
    : `absolute top-1/2 w-full rounded-b-sm ${color}`;
}

function SwitchEquityChart({
  days,
  modeAName,
  modeBName,
}: {
  days: ModeSwitchDay[];
  modeAName: string;
  modeBName: string;
}) {
  const switched = cumulative(days.map((day) => day.switchedPnl));
  const modeA = cumulative(days.map((day) => day.modeAPnl));
  const modeB = cumulative(days.map((day) => day.modeBPnl));
  const allValues = [...switched, ...modeA, ...modeB, 0];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const width = 760;
  const height = 230;
  const x = (index: number) =>
    days.length <= 1 ? 0 : (index / (days.length - 1)) * width;
  const y = (value: number) => height - ((value - min) / span) * height;

  return (
    <div className="subtle-card p-4">
      <div className="mb-3 flex flex-wrap justify-between gap-3">
        <div className="chart-heading">
          <span>Switched equity</span>
        </div>
        <div className="quiet-text flex flex-wrap gap-3 text-xs">
          <span>Switch</span>
          <span>{modeAName}</span>
          <span>{modeBName}</span>
        </div>
      </div>
      <svg
        className="h-64 w-full overflow-visible"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title>Switched equity compared with always-running each mode</title>
        <line
          stroke="rgba(148, 163, 184, 0.35)"
          x1="0"
          x2={width}
          y1={y(0)}
          y2={y(0)}
        />
        <polyline
          fill="none"
          points={pointsFor(switched, x, y)}
          stroke="#2dd4bf"
          strokeWidth="4"
        />
        <polyline
          fill="none"
          points={pointsFor(modeA, x, y)}
          stroke="#f59e0b"
          strokeWidth="2"
        />
        <polyline
          fill="none"
          points={pointsFor(modeB, x, y)}
          stroke="#38bdf8"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function ModeSwitchDayTable({
  days,
  modeAName,
  modeBName,
}: {
  days: ModeSwitchDay[];
  modeAName: string;
  modeBName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const sortedDays = [...days].sort((left, right) =>
    right.tradingDate.localeCompare(left.tradingDate),
  );

  return (
    <div className="border-t border-slate-800 pt-4">
      <button
        aria-expanded={isOpen}
        className="ghost-button w-full justify-between"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>Mode switch day table ({days.length})</span>
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
                <th>Signal</th>
                <th>Selected</th>
                <th>Mode A</th>
                <th>Mode B</th>
                <th>Switched</th>
                <th>Opportunity cost</th>
              </tr>
            </thead>
            <tbody>
              {sortedDays.map((day) => (
                <tr key={day.tradingDate}>
                  <td>{day.tradingDate}</td>
                  <td>
                    <span className="quiet-text block text-xs">
                      {day.signalLabel}
                    </span>
                    {formatNumber(day.signalValue)}
                  </td>
                  <td>
                    <span
                      className={
                        day.selectedMode === "mode-a"
                          ? "rounded-sm bg-amber-400/15 px-2 py-1 font-semibold text-amber-200"
                          : "rounded-sm bg-sky-400/15 px-2 py-1 font-semibold text-sky-200"
                      }
                    >
                      {day.selectedMode === "mode-a" ? modeAName : modeBName}
                    </span>
                  </td>
                  <td className={toneClass(day.modeAPnl)}>
                    {formatCurrency(day.modeAPnl)}
                  </td>
                  <td className={toneClass(day.modeBPnl)}>
                    {formatCurrency(day.modeBPnl)}
                  </td>
                  <td className={toneClass(day.switchedPnl)}>
                    {formatCurrency(day.switchedPnl)}
                  </td>
                  <td className={toneClass(-day.opportunityCost)}>
                    {formatCurrency(day.opportunityCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function operatorLabel(operator: ModeSwitchOperator) {
  if (operator === "gt") {
    return ">";
  }

  if (operator === "gte") {
    return ">=";
  }

  if (operator === "lt") {
    return "<";
  }

  return "<=";
}

const switchFeatureOptions: Array<{
  value: ModeSwitchFeature;
  label: (settings: AnalysisSettings) => string;
}> = [
  {
    value: "previous-rsi",
    label: (settings) => `Previous RSI${settings.rsiPeriod}`,
  },
  {
    value: "previous-atr",
    label: (settings) => `Previous ATR${settings.atrPeriod}`,
  },
  {
    value: "opening-range-5-pct",
    label: () => "Opening range 5%",
  },
  {
    value: "opening-range-10-pct",
    label: () => "Opening range 10%",
  },
  {
    value: "opening-range-15-pct",
    label: () => "Opening range 15%",
  },
  {
    value: "previous-closing-range-15-pct",
    label: () => "Previous 15:45-16:00 range%",
  },
];

function isPercentSwitchFeature(feature: ModeSwitchFeature) {
  return (
    feature === "opening-range-5-pct" ||
    feature === "opening-range-10-pct" ||
    feature === "opening-range-15-pct" ||
    feature === "previous-closing-range-15-pct"
  );
}

function defaultDisplayThreshold(
  feature: ModeSwitchFeature,
  settings: AnalysisSettings,
) {
  if (feature === "previous-rsi") {
    return settings.rsiUpperBand;
  }

  if (feature === "previous-atr") {
    return settings.atrPeriod;
  }

  if (feature === "opening-range-5-pct") {
    return 0.25;
  }

  if (feature === "opening-range-10-pct") {
    return 0.4;
  }

  if (feature === "opening-range-15-pct") {
    return 0.5;
  }

  return 0.25;
}

function toRuleThreshold(feature: ModeSwitchFeature, displayThreshold: number) {
  return isPercentSwitchFeature(feature)
    ? displayThreshold / 100
    : displayThreshold;
}

function fromRuleThreshold(feature: ModeSwitchFeature, threshold: number) {
  return isPercentSwitchFeature(feature) ? threshold * 100 : threshold;
}

function formatSwitchThreshold(feature: ModeSwitchFeature, threshold: number) {
  return isPercentSwitchFeature(feature)
    ? `${formatNumber(threshold * 100, 2)}%`
    : formatNumber(threshold, 2);
}

function cumulative(values: number[]) {
  let total = 0;
  return values.map((value) => {
    total += value;
    return total;
  });
}

function pointsFor(
  values: number[],
  x: (index: number) => number,
  y: (value: number) => number,
) {
  return values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
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
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <button
          className="ghost-button min-h-10"
          disabled={thresholdDays.length === 0}
          onClick={() =>
            downloadAlignedDaysCsv({
              candidateName,
              days: thresholdDays,
              fileName: csvFileName(
                "material-deltas",
                goldenName,
                candidateName,
              ),
              goldenName,
            })
          }
          type="button"
        >
          <Download aria-hidden size={15} />
          Export material days
        </button>
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

function downloadAlignedDaysCsv({
  days,
  goldenName,
  candidateName,
  fileName,
}: {
  days: ReturnType<typeof alignDailyPnL>;
  goldenName: string;
  candidateName: string;
  fileName: string;
}) {
  const rows = [
    [
      "trading_date",
      "golden_run",
      "candidate_run",
      "golden_pnl",
      "candidate_pnl",
      "delta",
      "winner",
      "golden_trades",
      "candidate_trades",
    ],
    ...days.map((day) => [
      day.tradingDate,
      goldenName,
      candidateName,
      String(day.goldenPnl),
      String(day.candidatePnl),
      String(day.delta),
      day.delta > 0 ? candidateName : day.delta < 0 ? goldenName : "tie",
      String(day.goldenTrades),
      String(day.candidateTrades),
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([`${csv}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function csvFileName(
  prefix: string,
  goldenName: string,
  candidateName: string,
) {
  return `${prefix}-${slugify(goldenName)}-vs-${slugify(candidateName)}`;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "run"
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

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
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

function MetricBarComparison({
  fullRuns,
  periodRuns,
  periodLabel,
}: {
  fullRuns: ComparisonRun[];
  periodRuns: ComparisonRun[];
  periodLabel: string;
}) {
  const [metricBasis, setMetricBasis] = useState<"period" | "full">("period");
  const runs = metricBasis === "period" ? periodRuns : fullRuns;
  const tradeLabel = metricBasis === "period" ? "Sessions" : "Trades";
  const winLabel = metricBasis === "period" ? "Win day rate" : "Win rate";
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
      label: winLabel,
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
      label: tradeLabel,
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
            {metricBasis === "period"
              ? `${periodLabel}: metrics are rebuilt from aligned daily PnL.`
              : "Full imported run metrics, regardless of date overlap."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="grid gap-1">
            <span className="quiet-text text-xs font-semibold uppercase">
              Metric basis
            </span>
            <select
              className="input min-h-10"
              onChange={(event) =>
                setMetricBasis(event.target.value as "period" | "full")
              }
              value={metricBasis}
            >
              <option value="period">Selected period</option>
              <option value="full">Full imported runs</option>
            </select>
          </label>
          <SlidersHorizontal aria-hidden className="quiet-text" size={20} />
        </div>
      </div>
      {metricBasis === "period" ? (
        <p className="quiet-text mb-4 rounded-sm border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm">
          Showing only the selected golden/candidate pair because period metrics
          depend on the current date handling.
        </p>
      ) : null}
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
