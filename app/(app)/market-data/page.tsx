import { RefreshCcw, Upload } from "lucide-react";

import {
  importMarketSessionFeaturesAction,
  refreshAllMarketDataAction,
  refreshMarketDataAction,
} from "@/app/actions";
import { listMarketRows } from "@/lib/db/repository";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";

export default async function MarketDataPage() {
  const rows = await listMarketRows();
  const cachedRows = rows.filter((row) => row.barCount > 0);
  const yahooRows = rows.filter((row) => row.yahooSymbol);
  const staleRows = yahooRows.filter((row) => isStale(row.fetchedAt));

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Market data</h1>
          <p>Yahoo futures bars cached into Turso for regime analysis.</p>
        </div>
        <form
          action={refreshAllMarketDataAction}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="grid gap-1">
            <span className="quiet-text text-xs font-semibold uppercase">
              Lookback days
            </span>
            <input
              className="input min-h-11 w-32"
              defaultValue="420"
              max="2500"
              min="30"
              name="lookbackDays"
              type="number"
            />
          </label>
          <button className="primary-button" type="submit">
            <RefreshCcw aria-hidden size={16} />
            Refresh all
          </button>
        </form>
      </section>

      <section className="metric-grid">
        <Metric label="Instruments" value={String(rows.length)} />
        <Metric label="With Yahoo symbol" value={String(yahooRows.length)} />
        <Metric label="Cached" value={String(cachedRows.length)} />
        <Metric label="Stale caches" value={String(staleRows.length)} />
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Manual session-feature import</h2>
            <p>
              Backfill opening range and close-range data when Yahoo intraday
              history is too short.
            </p>
          </div>
        </div>
        <form
          action={importMarketSessionFeaturesAction}
          className="grid gap-3 xl:grid-cols-[280px_1fr_auto]"
        >
          <label className="grid gap-2">
            <span className="label-text">Instrument</span>
            <select className="input" name="instrumentId" required>
              {rows.map((row) => (
                <option key={row.instrumentId} value={row.instrumentId}>
                  {row.symbol}
                  {row.yahooSymbol ? ` / ${row.yahooSymbol}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label-text">CSV rows</span>
            <textarea
              className="input min-h-32 font-mono text-xs"
              name="sessionFeatureCsv"
              placeholder={
                "date,price,or5,or10,or15,closeRange15\n2026-03-16,20000,100,160,220,75"
              }
              required
            />
          </label>
          <div className="flex items-end">
            <button className="primary-button min-h-11 w-full" type="submit">
              <Upload aria-hidden size={16} />
              Import features
            </button>
          </div>
        </form>
        <p className="quiet-text mt-3 text-sm">
          Supported columns include date, price, or5, or10, or15, closeRange15,
          plus optional or5%, or10%, or15%, and closeRange15%. Percent values
          should be pasted as human percentages like 0.5 or 0.5%.
        </p>
      </section>

      <section className="panel overflow-x-auto">
        {rows.length === 0 ? (
          <div className="grid min-h-80 place-items-center text-center">
            <div>
              <p className="empty-title text-lg font-semibold">
                No instruments yet.
              </p>
              <p className="quiet-text mt-2 text-sm">
                Import a run with a Yahoo symbol like ES=F to seed market data.
              </p>
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Yahoo</th>
                <th>Cached range</th>
                <th>Bars</th>
                <th>OR cache</th>
                <th>Latest day</th>
                <th>Close</th>
                <th>ATR 14</th>
                <th>OR15%</th>
                <th>Close range%</th>
                <th>Status</th>
                <th>Fetched</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.instrumentId}>
                  <td className="strong-text font-semibold">{row.symbol}</td>
                  <td>{row.yahooSymbol ?? "n/a"}</td>
                  <td>{formatRange(row.firstTradingDate, row.tradingDate)}</td>
                  <td>{row.barCount}</td>
                  <td>{row.sessionFeatureCount}</td>
                  <td>{row.tradingDate ?? "n/a"}</td>
                  <td>{formatCurrency(row.close)}</td>
                  <td>{formatNumber(row.atr14)}</td>
                  <td>{formatPercent(row.openingRange15Pct)}</td>
                  <td>{formatPercent(row.closingRange15Pct)}</td>
                  <td>
                    <span className={statusClass(row.sourceStatus)}>
                      {row.sourceStatus ?? "not cached"}
                    </span>
                    {row.sourceMessage ? (
                      <p className="quiet-text mt-1 max-w-72 text-xs">
                        {row.sourceMessage}
                      </p>
                    ) : null}
                  </td>
                  <td>{formatDate(row.fetchedAt)}</td>
                  <td>
                    {row.yahooSymbol ? (
                      <form
                        action={refreshMarketDataAction}
                        className="flex flex-wrap justify-end gap-2"
                      >
                        <input
                          name="instrumentId"
                          type="hidden"
                          value={row.instrumentId}
                        />
                        <input
                          name="yahooSymbol"
                          type="hidden"
                          value={row.yahooSymbol}
                        />
                        <input
                          className="input min-h-10 w-24"
                          defaultValue="420"
                          max="2500"
                          min="30"
                          name="lookbackDays"
                          title="Lookback days"
                          type="number"
                        />
                        <button className="ghost-button" type="submit">
                          <RefreshCcw aria-hidden size={15} />
                          Refresh
                        </button>
                      </form>
                    ) : null}
                  </td>
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

function formatRange(start: string | null, end: string | null) {
  if (!start || !end) {
    return "n/a";
  }

  return `${start} to ${end}`;
}

function statusClass(status: string | null) {
  if (status === "ok") {
    return "text-emerald-300";
  }

  if (status === "error") {
    return "text-rose-300";
  }

  return "text-slate-400";
}

function isStale(fetchedAt: string | null) {
  if (!fetchedAt) {
    return true;
  }

  const oneDayMs = 24 * 60 * 60 * 1000;
  return Date.now() - new Date(fetchedAt).getTime() > oneDayMs;
}
