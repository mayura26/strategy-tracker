import type { DailyRunMetric } from "@/lib/analytics";
import { buildDistribution } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import type { NormalizedTradeSummary } from "@/lib/imports/ninjatrader";

export function EquityCurve({ days }: { days: DailyRunMetric[] }) {
  const points = days.map((day) => day.cumulativeNetProfit);
  const path = buildPath(points);

  return (
    <div className="chart-panel">
      <div className="chart-heading">
        <span>Equity curve</span>
        <span>{points.length} sessions</span>
      </div>
      <svg className="h-52 w-full" role="img" viewBox="0 0 640 220">
        <title>Daily cumulative net profit</title>
        <line className="stroke-stone-200" x1="0" x2="640" y1="110" y2="110" />
        <path className="fill-none stroke-emerald-600 stroke-[3]" d={path} />
      </svg>
    </div>
  );
}

export function DailyBars({ days }: { days: DailyRunMetric[] }) {
  const maxAbs = Math.max(...days.map((day) => Math.abs(day.netProfit)), 1);

  return (
    <div className="chart-panel">
      <div className="chart-heading">
        <span>Daily PnL</span>
        <span>
          {formatCurrency(days.reduce((sum, day) => sum + day.netProfit, 0))}
        </span>
      </div>
      <div className="flex h-52 items-end gap-1 overflow-hidden">
        {days.map((day) => {
          const height = Math.max((Math.abs(day.netProfit) / maxAbs) * 92, 3);
          return (
            <div
              className="flex min-w-1 flex-1 flex-col items-center justify-end"
              key={day.tradingDate}
              title={`${day.tradingDate}: ${formatCurrency(day.netProfit)}`}
            >
              <div
                className={
                  day.netProfit >= 0
                    ? "w-full rounded-t-sm bg-emerald-500"
                    : "w-full rounded-t-sm bg-rose-500"
                }
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PnlDistribution({
  trades,
}: {
  trades: NormalizedTradeSummary[];
}) {
  const buckets = buildDistribution(
    trades.map((trade) => trade.netProfit),
    14,
  );
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);

  return (
    <div className="chart-panel">
      <div className="chart-heading">
        <span>PnL distribution</span>
        <span>{trades.length} trades</span>
      </div>
      <div className="flex h-52 items-end gap-2">
        {buckets.map((bucket) => (
          <div
            className="flex flex-1 flex-col items-center justify-end gap-2"
            key={`${bucket.start}-${bucket.end}`}
            title={`${formatCurrency(bucket.start)} to ${formatCurrency(bucket.end)}: ${bucket.count}`}
          >
            <div
              className="w-full rounded-t-sm bg-stone-800"
              style={{ height: `${(bucket.count / maxCount) * 100}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPath(values: number[]) {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const step = values.length === 1 ? 640 : 640 / (values.length - 1);

  return values
    .map((value, index) => {
      const x = index * step;
      const y = 200 - ((value - min) / span) * 180 + 10;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
