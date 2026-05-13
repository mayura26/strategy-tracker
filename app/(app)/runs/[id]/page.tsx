import { Crown } from "lucide-react";
import { notFound } from "next/navigation";

import { setGoldenRunAction } from "@/app/actions";
import { DailyBars, EquityCurve, PnlDistribution } from "@/components/charts";
import type { DailyRunMetric } from "@/lib/analytics";
import { calculateGoldenDelta, calculateRunMetrics } from "@/lib/analytics";
import type { MarketBar } from "@/lib/db/repository";
import { getRunDetail } from "@/lib/db/repository";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  toneClass,
} from "@/lib/format";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getRunDetail(id);

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
  const goldenDayRows = buildGoldenDayRows(
    run.dailyMetrics,
    run.goldenRun?.dailyMetrics ?? [],
  );

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>{run.name}</h1>
          <p>
            {run.botName} / {run.botModeName ?? "No mode"} /{" "}
            {run.instrumentSymbol} / {run.timeframe}
          </p>
        </div>
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
          <PnlDistribution trades={run.trades} />
        </div>
      </section>

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
            <h2>Market days</h2>
            <p>Daily PnL joined to cached Yahoo bars.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>PnL</th>
                <th>ATR 14</th>
                <th>Range</th>
                <th>Gap</th>
                <th>Close</th>
              </tr>
            </thead>
            <tbody>
              {regimeStats.joinedDays.slice(-20).map((day) => (
                <tr key={day.tradingDate}>
                  <td>{day.tradingDate}</td>
                  <td className={toneClass(day.netProfit)}>
                    {formatCurrency(day.netProfit)}
                  </td>
                  <td>{formatNumber(day.atr14)}</td>
                  <td>{formatNumber(day.range)}</td>
                  <td className={toneClass(day.gap)}>
                    {formatNumber(day.gap)}
                  </td>
                  <td>{formatNumber(day.close)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {run.goldenRun ? (
        <section className="panel overflow-x-auto">
          <div className="section-title">
            <h2>Golden day differences</h2>
            <p>Largest daily divergences vs {run.goldenRun.name}.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>This run</th>
                <th>Golden</th>
                <th>Delta</th>
                <th>Trades</th>
                <th>Golden trades</th>
              </tr>
            </thead>
            <tbody>
              {goldenDayRows.slice(0, 24).map((day) => (
                <tr key={day.tradingDate}>
                  <td>{day.tradingDate}</td>
                  <td className={toneClass(day.runPnl)}>
                    {formatCurrency(day.runPnl)}
                  </td>
                  <td className={toneClass(day.goldenPnl)}>
                    {formatCurrency(day.goldenPnl)}
                  </td>
                  <td className={toneClass(day.delta)}>
                    {formatCurrency(day.delta)}
                  </td>
                  <td>{day.runTrades}</td>
                  <td>{day.goldenTrades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
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
            <Detail label="Settings" value={run.settingsJson} />
            <Detail label="Notes" value={run.notes || "n/a"} />
          </dl>
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

function buildGoldenDayRows(
  runDays: DailyRunMetric[],
  goldenDays: DailyRunMetric[],
) {
  const runMap = new Map(runDays.map((day) => [day.tradingDate, day]));
  const goldenMap = new Map(goldenDays.map((day) => [day.tradingDate, day]));
  const keys = new Set([...runMap.keys(), ...goldenMap.keys()]);

  return [...keys]
    .map((tradingDate) => {
      const runDay = runMap.get(tradingDate);
      const goldenDay = goldenMap.get(tradingDate);
      const runPnl = runDay?.netProfit ?? 0;
      const goldenPnl = goldenDay?.netProfit ?? 0;

      return {
        tradingDate,
        runPnl,
        goldenPnl,
        delta: runPnl - goldenPnl,
        runTrades: runDay?.tradeCount ?? 0,
        goldenTrades: goldenDay?.tradeCount ?? 0,
      };
    })
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
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
