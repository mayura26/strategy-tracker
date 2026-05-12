import Link from "next/link";

import { listRuns } from "@/lib/db/repository";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  toneClass,
} from "@/lib/format";

export default async function ComparePage() {
  const runs = await listRuns();
  const groups = runs.reduce((map, run) => {
    const key = `${run.botName} / ${run.botModeName ?? "No mode"} / ${run.instrumentSymbol} / ${run.timeframe}`;
    const scopedRuns = map.get(key) ?? [];
    scopedRuns.push(run);
    map.set(key, scopedRuns);
    return map;
  }, new Map<string, typeof runs>());

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Compare</h1>
          <p>
            Find the runs that differ most from their scoped golden baseline.
          </p>
        </div>
      </section>
      {[...groups.entries()].map(([scope, scopedRuns]) => {
        const golden = scopedRuns.find((run) => run.isGolden);
        return (
          <section className="panel overflow-x-auto" key={scope}>
            <div className="section-title">
              <h2>{scope}</h2>
              <p>
                Golden:{" "}
                {golden ? (
                  <Link
                    className="link-text font-semibold"
                    href={`/runs/${golden.id}`}
                  >
                    {golden.name}
                  </Link>
                ) : (
                  "not pinned"
                )}
              </p>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>PnL</th>
                  <th>PnL delta</th>
                  <th>Win</th>
                  <th>PF</th>
                  <th>Drawdown</th>
                  <th>Trades</th>
                </tr>
              </thead>
              <tbody>
                {scopedRuns.map((run) => {
                  const pnlDelta = golden
                    ? run.netProfit - golden.netProfit
                    : null;
                  return (
                    <tr key={run.id}>
                      <td>
                        <Link
                          className="link-text font-semibold"
                          href={`/runs/${run.id}`}
                        >
                          {run.name}
                        </Link>
                      </td>
                      <td className={toneClass(run.netProfit)}>
                        {formatCurrency(run.netProfit)}
                      </td>
                      <td className={toneClass(pnlDelta)}>
                        {formatCurrency(pnlDelta)}
                      </td>
                      <td>{formatPercent(run.winRate)}</td>
                      <td>{formatNumber(run.profitFactor)}</td>
                      <td className={toneClass(run.maxDrawdown)}>
                        {formatCurrency(run.maxDrawdown)}
                      </td>
                      <td>{run.tradeCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
