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
              <p className="empty-title text-lg font-semibold">
                No runs imported yet.
              </p>
              <p className="quiet-text mt-2 text-sm">
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
                <th>Data period</th>
                <th>Imported</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>
                    <Link
                      className="link-text inline-flex items-center gap-2 font-semibold"
                      href={`/runs/${run.id}`}
                    >
                      {run.isGolden ? <Crown aria-hidden size={15} /> : null}
                      {run.name}
                    </Link>
                  </td>
                  <td className="quiet-text">
                    {run.botName} / {run.botModeName ?? "No mode"} /{" "}
                    {run.instrumentSymbol} / {run.timeframe}
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
                  <td>
                    <span className="rounded-sm border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-200">
                      {formatCoverage(run)}
                    </span>
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

function formatCoverage(run: {
  coverageStartDate: string | null;
  coverageEndDate: string | null;
}) {
  if (!run.coverageStartDate || !run.coverageEndDate) {
    return "n/a";
  }

  return `${run.coverageStartDate} to ${run.coverageEndDate}`;
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
