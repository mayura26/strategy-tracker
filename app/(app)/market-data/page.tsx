import { RefreshCcw } from "lucide-react";

import {
  refreshAllMarketDataAction,
  refreshMarketDataAction,
} from "@/app/actions";
import { listMarketRows } from "@/lib/db/repository";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export default async function MarketDataPage() {
  const rows = await listMarketRows();

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Market data</h1>
          <p>Yahoo futures bars cached into Turso for regime analysis.</p>
        </div>
        <form action={refreshAllMarketDataAction}>
          <button className="primary-button" type="submit">
            <RefreshCcw aria-hidden size={16} />
            Refresh all
          </button>
        </form>
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
                <th>Latest day</th>
                <th>Close</th>
                <th>ATR 14</th>
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
                  <td>{row.tradingDate ?? "n/a"}</td>
                  <td>{formatCurrency(row.close)}</td>
                  <td>{formatNumber(row.atr14)}</td>
                  <td>{row.sourceStatus ?? "not cached"}</td>
                  <td>{formatDate(row.fetchedAt)}</td>
                  <td>
                    {row.yahooSymbol ? (
                      <form action={refreshMarketDataAction}>
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
