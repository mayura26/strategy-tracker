import { BrainCircuit, Crown, Save } from "lucide-react";
import { notFound } from "next/navigation";

import {
  createRegimeAnalysisJobAction,
  setGoldenRunAction,
  updateRunMetadataAction,
} from "@/app/actions";
import {
  DailyBars,
  DailyPnlDistribution,
  EquityCurve,
  MarketPerformanceChart,
} from "@/components/charts";
import { DeleteRunForm } from "@/components/delete-run-form";
import { GoldenDailyDrilldown } from "@/components/golden-daily-drilldown";
import { RegimeDiscoveryWorkbench } from "@/components/regime-discovery-workbench";
import type { DailyRunMetric } from "@/lib/analytics";
import { calculateGoldenDelta, calculateRunMetrics } from "@/lib/analytics";
import type { MarketBar } from "@/lib/db/repository";
import { getAnalysisSettings, getRunDetail } from "@/lib/db/repository";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  toneClass,
} from "@/lib/format";
import { discoverRegimeThresholds } from "@/lib/regime-discovery";
import { buildPredictiveRegimeDays } from "@/lib/regime-features";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [run, analysisSettings] = await Promise.all([
    getRunDetail(id),
    getAnalysisSettings(),
  ]);

  if (!run) {
    notFound();
  }

  const metrics = calculateRunMetrics(run.trades);
  const goldenMetrics = run.goldenRun
    ? {
        tradeCount: run.goldenRun.tradeCount,
        netProfit: run.goldenRun.netProfit,
        grossProfit: 0,
        grossLoss: 0,
        winCount: 0,
        lossCount: 0,
        flatCount: 0,
        winRate: run.goldenRun.winRate,
        profitFactor: run.goldenRun.profitFactor,
        expectancy: run.goldenRun.expectancy,
        maxDrawdown: run.goldenRun.maxDrawdown,
        bestTrade: 0,
        worstTrade: 0,
        avgWin: 0,
        avgLoss: 0,
        avgMae: null,
        avgMfe: null,
        avgEtd: null,
        firstTradeAt: run.goldenRun.firstTradeAt,
        lastTradeAt: run.goldenRun.lastTradeAt,
      }
    : null;
  const delta = calculateGoldenDelta(
    metrics,
    goldenMetrics,
    run.dailyMetrics,
    run.goldenRun?.dailyMetrics ?? [],
  );
  const regimeStats = buildRegimeStats(run.dailyMetrics, run.marketBars);
  const predictiveDays = buildPredictiveRegimeDays(
    run.dailyMetrics,
    run.marketBars,
    analysisSettings,
  );
  const thresholdSuggestions = discoverRegimeThresholds(predictiveDays);
  const emaLabel = `${analysisSettings.emaFastPeriod}/${analysisSettings.emaMidPeriod}/${analysisSettings.emaSlowPeriod}`;

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>{run.name}</h1>
          <p>
            {run.botName} / {run.botModeName ?? "No mode"} /{" "}
            {run.instrumentSymbol} / {run.timeframe}
          </p>
          <p className="mt-2 inline-flex rounded-sm border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-200">
            Data period {formatRunCoverage(run)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={createRegimeAnalysisJobAction}>
            <input name="runId" type="hidden" value={run.id} />
            <button className="ghost-button" type="submit">
              <BrainCircuit aria-hidden size={16} />
              Analyze
            </button>
          </form>
          <form action={setGoldenRunAction}>
            <input name="runId" type="hidden" value={run.id} />
            <button
              className={run.isGolden ? "ghost-button" : "primary-button"}
              type="submit"
            >
              <Crown aria-hidden size={16} />
              {run.isGolden ? "Golden baseline" : "Pin golden"}
            </button>
          </form>
        </div>
      </section>

      <section className="metric-grid">
        <Metric
          label="Net PnL"
          tone={run.netProfit}
          value={formatCurrency(run.netProfit)}
        />
        <Metric label="Trades" value={String(run.tradeCount)} />
        <Metric label="Win rate" value={formatPercent(run.winRate)} />
        <Metric label="Profit factor" value={formatNumber(run.profitFactor)} />
        <Metric label="Expectancy" value={formatCurrency(run.expectancy)} />
        <Metric
          label="Max drawdown"
          tone={run.maxDrawdown}
          value={formatCurrency(run.maxDrawdown)}
        />
      </section>

      {delta ? (
        <section className="panel">
          <div className="section-title">
            <h2>Golden delta</h2>
            <p>Compared with {run.goldenRun?.name}</p>
          </div>
          <div className="metric-grid">
            <Metric
              label="PnL delta"
              tone={delta.netProfitDelta}
              value={formatCurrency(delta.netProfitDelta)}
            />
            <Metric
              label="Win delta"
              tone={delta.winRateDelta}
              value={formatPercent(delta.winRateDelta)}
            />
            <Metric
              label="Drawdown delta"
              tone={delta.maxDrawdownDelta}
              value={formatCurrency(delta.maxDrawdownDelta)}
            />
            <Metric label="Shared days" value={String(delta.sharedDays)} />
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <EquityCurve days={run.dailyMetrics} />
        </div>
        <DailyBars days={run.dailyMetrics} />
        <div className="xl:col-span-3">
          <DailyPnlDistribution days={run.dailyMetrics} />
        </div>
      </section>

      <MarketPerformanceChart
        bars={run.marketBars}
        days={run.dailyMetrics}
        instrumentSymbol={run.instrumentSymbol}
      />

      <RegimeDiscoveryWorkbench
        days={predictiveDays}
        emaLabel={emaLabel}
        rsiPeriod={analysisSettings.rsiPeriod}
      />

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="panel">
          <div className="section-title">
            <h2>Market regime</h2>
            <p>
              {regimeStats.marketDayCount > 0
                ? `${regimeStats.marketDayCount} days matched with cached bars`
                : "Refresh market data to unlock ATR analysis"}
            </p>
          </div>
          <div className="grid gap-3">
            <RegimeMetric
              label="High ATR avg"
              tone={regimeStats.highAtr.averagePnl}
              value={formatCurrency(regimeStats.highAtr.averagePnl)}
              detail={`${regimeStats.highAtr.count} days / ${formatPercent(regimeStats.highAtr.winRate)} win`}
            />
            <RegimeMetric
              label="Low ATR avg"
              tone={regimeStats.lowAtr.averagePnl}
              value={formatCurrency(regimeStats.lowAtr.averagePnl)}
              detail={`${regimeStats.lowAtr.count} days / ${formatPercent(regimeStats.lowAtr.winRate)} win`}
            />
            <RegimeMetric
              label="High range avg"
              tone={regimeStats.highRange.averagePnl}
              value={formatCurrency(regimeStats.highRange.averagePnl)}
              detail={`${regimeStats.highRange.count} days / ${formatPercent(regimeStats.highRange.winRate)} win`}
            />
          </div>
        </div>
        <div className="panel overflow-x-auto">
          <div className="section-title">
            <h2>Predictive market days</h2>
            <p>Daily PnL joined to prior-session Yahoo features.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>PnL</th>
                <th>Prior day</th>
                <th>Prev ATR</th>
                <th>Prev RSI</th>
                <th>EMA stack</th>
                <th>EMA cross</th>
              </tr>
            </thead>
            <tbody>
              {predictiveDays.slice(-20).map((day) => (
                <tr key={day.tradingDate}>
                  <td>{day.tradingDate}</td>
                  <td className={toneClass(day.netProfit)}>
                    {formatCurrency(day.netProfit)}
                  </td>
                  <td>{day.previousTradingDate ?? "n/a"}</td>
                  <td>{formatNumber(day.previousAtr14)}</td>
                  <td>{formatNumber(day.previousRsi)}</td>
                  <td>{formatRegimeState(day.previousEmaStack)}</td>
                  <td>
                    {formatRegimeState(day.previousEmaCrossFastMid)} /{" "}
                    {formatRegimeState(day.previousEmaCrossMidSlow)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {thresholdSuggestions.length > 0 ? (
        <section className="panel overflow-x-auto">
          <div className="section-title">
            <h2>Threshold discovery</h2>
            <p>Ranked conditions from cached market bars and daily PnL.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Action</th>
                <th>Days</th>
                <th>Avg PnL</th>
                <th>Other avg</th>
                <th>Lift</th>
                <th>Win rate</th>
                <th>Validation</th>
                <th>Total PnL</th>
              </tr>
            </thead>
            <tbody>
              {thresholdSuggestions.map((suggestion) => (
                <tr key={suggestion.key}>
                  <td>{suggestion.condition}</td>
                  <td
                    className={
                      suggestion.action === "favor"
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }
                  >
                    {suggestion.action === "favor" ? "Favor" : "Avoid"}
                  </td>
                  <td>
                    {suggestion.selectedCount} /{" "}
                    {suggestion.selectedCount + suggestion.otherCount}
                  </td>
                  <td className={toneClass(suggestion.selectedAveragePnl)}>
                    {formatCurrency(suggestion.selectedAveragePnl)}
                  </td>
                  <td className={toneClass(suggestion.otherAveragePnl)}>
                    {formatCurrency(suggestion.otherAveragePnl)}
                  </td>
                  <td className={toneClass(suggestion.lift)}>
                    {formatCurrency(suggestion.lift)}
                  </td>
                  <td>{formatPercent(suggestion.selectedWinRate)}</td>
                  <td>
                    <span
                      className={
                        suggestion.validated
                          ? "text-emerald-300"
                          : "text-slate-400"
                      }
                    >
                      {suggestion.validationLift === null
                        ? "n/a"
                        : `${formatCurrency(suggestion.validationLift)} / ${
                            suggestion.validationCount
                          } days`}
                    </span>
                  </td>
                  <td className={toneClass(suggestion.selectedTotalPnl)}>
                    {formatCurrency(suggestion.selectedTotalPnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {run.goldenRun ? (
        <GoldenDailyDrilldown
          currentCoverage={{
            end: run.coverageEndDate,
            start: run.coverageStartDate,
          }}
          currentDays={run.dailyMetrics}
          currentName={run.name}
          goldenCoverage={{
            end: run.goldenRun.coverageEndDate,
            start: run.goldenRun.coverageStartDate,
          }}
          goldenDays={run.goldenRun.dailyMetrics}
          goldenName={run.goldenRun.name}
        />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="panel overflow-x-auto">
          <div className="section-title">
            <h2>Trade summary</h2>
            <p>{run.importInfo?.fileName}</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Close</th>
                <th>Trading day</th>
                <th>Net</th>
                <th>Equity</th>
                <th>MAE</th>
                <th>MFE</th>
                <th>ETD</th>
              </tr>
            </thead>
            <tbody>
              {run.trades.slice(-80).map((trade) => (
                <tr key={trade.tradeNumber}>
                  <td>{trade.tradeNumber}</td>
                  <td>{trade.closeTimeRaw}</td>
                  <td>{trade.tradingDate}</td>
                  <td className={toneClass(trade.netProfit)}>
                    {formatCurrency(trade.netProfit)}
                  </td>
                  <td>{formatCurrency(trade.cumulativeNetProfit)}</td>
                  <td>{formatCurrency(trade.mae)}</td>
                  <td>{formatCurrency(trade.mfe)}</td>
                  <td>{formatCurrency(trade.etd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="panel h-fit">
          <div className="section-title">
            <h2>Import record</h2>
          </div>
          <dl className="grid gap-3 text-sm">
            <Detail label="File" value={run.importInfo?.fileName ?? "n/a"} />
            <Detail
              label="Hash"
              value={run.importInfo?.fileHash.slice(0, 16) ?? "n/a"}
            />
            <Detail
              label="Profile"
              value={run.importInfo?.importProfile ?? "n/a"}
            />
            <Detail
              label="Imported"
              value={formatDate(run.importInfo?.createdAt)}
            />
          </dl>
          <form action={updateRunMetadataAction} className="mt-5 grid gap-3">
            <input name="runId" type="hidden" value={run.id} />
            <label className="grid gap-2">
              <span className="label-text">Run name</span>
              <input
                className="input"
                defaultValue={run.name}
                name="name"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="label-text">Timeframe</span>
              <input
                className="input"
                defaultValue={run.timeframe}
                name="timeframe"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="label-text">Tags</span>
              <input className="input" defaultValue={run.tags} name="tags" />
            </label>
            <label className="grid gap-2">
              <span className="label-text">Settings JSON</span>
              <textarea
                className="input min-h-32 font-mono text-xs"
                defaultValue={run.settingsJson}
                name="settingsJson"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="label-text">Notes</span>
              <textarea
                className="input min-h-28"
                defaultValue={run.notes}
                name="notes"
              />
            </label>
            <button className="primary-button" type="submit">
              <Save aria-hidden size={16} />
              Save run metadata
            </button>
          </form>
          <div className="mt-8 border-t border-rose-500/25 pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-rose-200/90">
              Danger zone
            </h3>
            <p className="quiet-text mt-2 text-sm">
              Permanently delete this run, its trades, daily metrics, and import
              record. If it is the golden baseline for its scope, that pin is
              cleared.
            </p>
            <div className="mt-4">
              <DeleteRunForm runId={run.id} runName={run.name} />
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function RegimeMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: number | null;
}) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong className={tone === null ? "" : toneClass(tone)}>{value}</strong>
      <p className="quiet-text mt-2 text-sm">{detail}</p>
    </div>
  );
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="quiet-text font-semibold">{label}</dt>
      <dd className="strong-text mt-1 break-words">{value}</dd>
    </div>
  );
}

function formatRunCoverage(run: {
  coverageStartDate: string | null;
  coverageEndDate: string | null;
}) {
  if (!run.coverageStartDate || !run.coverageEndDate) {
    return "n/a";
  }

  return `${run.coverageStartDate} to ${run.coverageEndDate}`;
}

function formatRegimeState(value: string | null) {
  if (!value) {
    return "n/a";
  }

  return value.replaceAll("-", " ");
}

function buildRegimeStats(days: DailyRunMetric[], bars: MarketBar[]) {
  const barsByDate = new Map(bars.map((bar) => [bar.tradingDate, bar]));
  const joinedDays = days.map((day) => {
    const bar = barsByDate.get(day.tradingDate);
    return {
      ...day,
      atr14: bar?.atr14 ?? null,
      range: bar?.range ?? null,
      gap: bar?.gap ?? null,
      close: bar?.close ?? null,
    };
  });
  const daysWithAtr = joinedDays.filter((day) => day.atr14 !== null);
  const daysWithRange = joinedDays.filter((day) => day.range !== null);
  const atrMedian = median(daysWithAtr.map((day) => day.atr14 ?? 0));
  const rangeMedian = median(daysWithRange.map((day) => day.range ?? 0));

  return {
    joinedDays,
    marketDayCount: daysWithAtr.length,
    highAtr: summarizeRegime(
      daysWithAtr.filter((day) => (day.atr14 ?? 0) >= atrMedian),
    ),
    lowAtr: summarizeRegime(
      daysWithAtr.filter((day) => (day.atr14 ?? 0) < atrMedian),
    ),
    highRange: summarizeRegime(
      daysWithRange.filter((day) => (day.range ?? 0) >= rangeMedian),
    ),
  };
}

function summarizeRegime(
  days: Array<DailyRunMetric & { atr14?: number | null }>,
) {
  if (days.length === 0) {
    return {
      count: 0,
      averagePnl: null,
      winRate: null,
    };
  }

  const totalPnl = days.reduce((sum, day) => sum + day.netProfit, 0);

  return {
    count: days.length,
    averagePnl: totalPnl / days.length,
    winRate: days.filter((day) => day.netProfit > 0).length / days.length,
  };
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
