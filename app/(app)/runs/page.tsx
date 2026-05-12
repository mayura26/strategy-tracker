import { Crown, Plus } from "lucide-react";
import Link from "next/link";

import { listRuns } from "@/lib/db/repository";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  toneClass,
} from "@/lib/format";

export default async function RunsPage() {
  const runs = await listRuns();
  const totalPnl = runs.reduce((sum, run) => sum + run.netProfit, 0);
  const goldenCount = runs.filter((run) => run.isGolden).length;

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Runs</h1>
          <p>Catalogue NinjaTrader summaries and compare research baselines.</p>
        </div>
        <Link className="primary-button" href="/runs/new">
          <Plus aria-hidden size={16} />
          Import CSV
        </Link>
      </section>

      <section className="metric-grid">
        <Metric label="Runs" value={String(runs.length)} />
        <Metric label="Golden baselines" value={String(goldenCount)} />
        <Metric label="Combined PnL" value={formatCurrency(totalPnl)} />
        <Metric
          label="Avg profit factor"
          value={formatNumber(
            average(runs.map((run) => run.profitFactor).filter(isNumber)),
          )}
        />
      </section>

      <section className="panel overflow-x-auto">
        {runs.length === 0 ? (
          <div className="grid min-h-80 place-items-center text-center">
            <div>
              <p className="text-lg font-semibold text-stone-950">
                No runs imported yet.
              </p>
              <p className="mt-2 text-sm text-stone-500">
                Start with the NinjaTrader CSV in your examples folder.
              </p>
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Scope</th>
                <th>Trades</th>
                <th>Net PnL</th>
                <th>Win</th>
                <th>PF</th>
                <th>Drawdown</th>
                <th>Imported</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>
                    <Link
                      className="inline-flex items-center gap-2 font-semibold text-stone-950 hover:text-teal-700"
                      href={`/runs/${run.id}`}
                    >
                      {run.isGolden ? <Crown aria-hidden size={15} /> : null}
                      {run.name}
                    </Link>
                  </td>
                  <td className="text-stone-600">
                    {run.botName} / {run.instrumentSymbol} / {run.timeframe}
                  </td>
                  <td>{run.tradeCount}</td>
                  <td className={toneClass(run.netProfit)}>
                    {formatCurrency(run.netProfit)}
                  </td>
                  <td>{formatPercent(run.winRate)}</td>
                  <td>{formatNumber(run.profitFactor)}</td>
                  <td className={toneClass(run.maxDrawdown)}>
                    {formatCurrency(run.maxDrawdown)}
                  </td>
                  <td>{formatDate(run.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isNumber(value: number | null): value is number {
  return value !== null;
}
