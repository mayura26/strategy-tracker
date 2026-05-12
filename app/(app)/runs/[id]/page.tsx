import { Crown } from "lucide-react";
import { notFound } from "next/navigation";

import { setGoldenRunAction } from "@/app/actions";
import { DailyBars, EquityCurve, PnlDistribution } from "@/components/charts";
import { calculateGoldenDelta, calculateRunMetrics } from "@/lib/analytics";
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

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>{run.name}</h1>
          <p>
            {run.botName} / {run.instrumentSymbol} / {run.timeframe}
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
      <dt className="font-semibold text-stone-500">{label}</dt>
      <dd className="mt-1 break-words text-stone-900">{value}</dd>
    </div>
  );
}
