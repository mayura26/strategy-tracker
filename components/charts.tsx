import type { DailyRunMetric } from "@/lib/analytics";
import { buildDistribution } from "@/lib/analytics";
import type { MarketBar } from "@/lib/db/repository";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { NormalizedTradeSummary } from "@/lib/imports/ninjatrader";
import { joinMarketPerformanceDays } from "@/lib/market-performance";

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
        <line
          className="stroke-slate-700/70"
          x1="0"
          x2="640"
          y1="110"
          y2="110"
        />
        <path className="fill-none stroke-teal-300 stroke-[3]" d={path} />
      </svg>
    </div>
  );
}

export function DailyBars({ days }: { days: DailyRunMetric[] }) {
  const maxAbs = Math.max(...days.map((day) => Math.abs(day.netProfit)), 1);
  const midpointIndex = Math.floor((days.length - 1) / 2);

  return (
    <div className="chart-panel">
      <div className="chart-heading">
        <span>Daily PnL</span>
        <span>
          {formatCurrency(days.reduce((sum, day) => sum + day.netProfit, 0))}
        </span>
      </div>
      <div className="grid grid-cols-[3.5rem_1fr] gap-3">
        <div className="quiet-text grid h-56 grid-rows-3 py-4 text-right text-[0.65rem] leading-none">
          <span>{formatCompactCurrency(maxAbs)}</span>
          <span className="self-center">$0</span>
          <span className="self-end">{formatCompactCurrency(-maxAbs)}</span>
        </div>
        <div
          className="grid h-56 items-center gap-1 overflow-hidden border-y border-slate-800 py-4"
          style={{
            gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {days.map((day) => {
            const height = Math.max((Math.abs(day.netProfit) / maxAbs) * 92, 3);

            return (
              <DailyPnlBar
                height={height}
                key={day.tradingDate}
                title={`${day.tradingDate}: ${formatCurrency(day.netProfit)}`}
                value={day.netProfit}
              />
            );
          })}
        </div>
      </div>
      <div className="quiet-text ml-[4.25rem] mt-2 flex justify-between text-[0.65rem]">
        <span>{days[0]?.tradingDate}</span>
        {days.length > 2 ? (
          <span>{days[midpointIndex]?.tradingDate}</span>
        ) : null}
        <span>{days.at(-1)?.tradingDate}</span>
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
      <div className="grid grid-cols-[3.5rem_1fr] gap-3">
        <div className="quiet-text grid h-60 grid-rows-[2rem_1fr] text-right text-[0.65rem] leading-none">
          <span />
          <div className="grid grid-rows-3 py-2">
            <span>{maxCount}</span>
            <span className="self-center">Trades</span>
            <span className="self-end">0</span>
          </div>
        </div>
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${Math.max(buckets.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {buckets.map((bucket) => (
            <div
              className="quiet-text flex min-h-8 items-end justify-center text-center text-[0.6rem] leading-tight"
              key={`${bucket.start}-${bucket.end}-label`}
              title={formatBucket(bucket.start, bucket.end)}
            >
              {formatCompactBucket(bucket.start, bucket.end)}
            </div>
          ))}
          {buckets.map((bucket) => {
            const height = Math.max(
              (bucket.count / maxCount) * 100,
              bucket.count ? 7 : 0,
            );
            const isLossBucket = bucket.end <= 0;
            const isMixedBucket = bucket.start < 0 && bucket.end > 0;

            return (
              <div
                className="flex h-52 items-end border-b border-slate-800"
                key={`${bucket.start}-${bucket.end}`}
                title={`${formatBucket(bucket.start, bucket.end)}: ${bucket.count} trades`}
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
        </div>
      </div>
    </div>
  );
}

function DailyPnlBar({
  value,
  height,
  title,
}: {
  value: number;
  height: number;
  title: string;
}) {
  return (
    <div className="relative h-48 w-full" title={title}>
      <div className="absolute top-1/2 h-px w-full bg-slate-700/70" />
      <div
        className={
          value >= 0
            ? "absolute bottom-1/2 w-full rounded-t-sm bg-teal-300"
            : "absolute top-1/2 w-full rounded-b-sm bg-rose-400"
        }
        style={{ height }}
      />
    </div>
  );
}

export function MarketPerformanceChart({
  days,
  bars,
  instrumentSymbol,
}: {
  days: DailyRunMetric[];
  bars: MarketBar[];
  instrumentSymbol: string;
}) {
  const joinedDays = joinMarketPerformanceDays(days, bars);
  const candleDays = joinedDays.filter((day) => day.hasCompleteOhlc);

  if (joinedDays.length === 0) {
    return (
      <div className="chart-panel grid min-h-80 place-items-center text-center">
        <div>
          <div className="chart-heading justify-center">
            <span>Underlying instrument</span>
          </div>
          <p className="empty-title text-lg font-semibold">
            Refresh market data to unlock instrument chart.
          </p>
          <p className="quiet-text mt-2 text-sm">
            Daily PnL will be joined to cached Yahoo OHLC bars by trading date.
          </p>
        </div>
      </div>
    );
  }

  const minPrice = Math.min(
    ...candleDays.map((day) => day.low ?? Number.POSITIVE_INFINITY),
  );
  const maxPrice = Math.max(
    ...candleDays.map((day) => day.high ?? Number.NEGATIVE_INFINITY),
  );
  const hasPriceRange =
    candleDays.length > 0 &&
    Number.isFinite(minPrice) &&
    Number.isFinite(maxPrice);
  const priceSpan = hasPriceRange ? maxPrice - minPrice || 1 : 1;
  const maxAbsPnl = Math.max(
    ...joinedDays.map((day) => Math.abs(day.netProfit)),
    1,
  );
  const chartWidth = 900;
  const priceTop = 42;
  const priceBottom = 230;
  const pnlZero = 303;
  const pnlMaxHeight = 54;
  const step =
    joinedDays.length <= 1 ? chartWidth : chartWidth / (joinedDays.length - 1);
  const candleWidth = Math.max(Math.min(step * 0.46, 10), 2);
  const xFor = (index: number) =>
    joinedDays.length <= 1 ? chartWidth / 2 : index * step;
  const yForPrice = (value: number) =>
    priceBottom - ((value - minPrice) / priceSpan) * (priceBottom - priceTop);

  return (
    <div className="chart-panel">
      <div className="chart-heading">
        <span>{instrumentSymbol} market + daily PnL</span>
        <span>{joinedDays.length} matched sessions</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-teal-300" />
          Up candle / profit day
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-rose-400" />
          Down candle / loss day
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-slate-500" />
          Partial OHLC
        </span>
      </div>
      <svg
        className="h-[24rem] w-full overflow-visible"
        role="img"
        viewBox="-20 0 940 360"
      >
        <title>
          Underlying instrument OHLC candlesticks with strategy daily PnL bars
        </title>
        <line
          className="stroke-slate-700/70"
          x1="0"
          x2={chartWidth}
          y1={priceBottom}
          y2={priceBottom}
        />
        <line
          className="stroke-slate-700/70"
          x1="0"
          x2={chartWidth}
          y1={pnlZero}
          y2={pnlZero}
        />
        {hasPriceRange ? (
          <>
            <text className="fill-slate-400 text-[11px]" x="0" y="28">
              {formatNumber(maxPrice)}
            </text>
            <text className="fill-slate-400 text-[11px]" x="0" y="247">
              {formatNumber(minPrice)}
            </text>
          </>
        ) : (
          <text
            className="fill-slate-400 text-[13px]"
            textAnchor="middle"
            x={chartWidth / 2}
            y="140"
          >
            Cached market bars matched, but no complete OHLC candles are
            available.
          </text>
        )}
        {joinedDays.map((day, index) => {
          const x = xFor(index);
          const pnlHeight =
            (Math.abs(day.netProfit) / maxAbsPnl) * pnlMaxHeight;
          const pnlY = day.netProfit >= 0 ? pnlZero - pnlHeight : pnlZero;
          const pnlColor =
            day.netProfit >= 0 ? "fill-teal-300" : "fill-rose-400";

          return (
            <g key={day.tradingDate}>
              <title>{tooltipForMarketPerformanceDay(day)}</title>
              {day.hasCompleteOhlc &&
              day.open !== null &&
              day.high !== null &&
              day.low !== null &&
              day.close !== null ? (
                <Candlestick
                  bodyWidth={candleWidth}
                  close={day.close}
                  high={day.high}
                  low={day.low}
                  open={day.open}
                  x={x}
                  yForPrice={yForPrice}
                />
              ) : (
                <circle className="fill-slate-500" cx={x} cy="136" r="2.5" />
              )}
              <rect
                className={pnlColor}
                height={Math.max(pnlHeight, day.netProfit === 0 ? 1 : 3)}
                rx="1.5"
                width={Math.max(candleWidth, 3)}
                x={x - Math.max(candleWidth, 3) / 2}
                y={pnlY}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Candlestick({
  x,
  open,
  high,
  low,
  close,
  bodyWidth,
  yForPrice,
}: {
  x: number;
  open: number;
  high: number;
  low: number;
  close: number;
  bodyWidth: number;
  yForPrice: (value: number) => number;
}) {
  const openY = yForPrice(open);
  const closeY = yForPrice(close);
  const highY = yForPrice(high);
  const lowY = yForPrice(low);
  const bodyY = Math.min(openY, closeY);
  const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
  const color =
    close >= open
      ? "fill-teal-300 stroke-teal-300"
      : "fill-rose-400 stroke-rose-400";

  return (
    <>
      <line className={color} x1={x} x2={x} y1={highY} y2={lowY} />
      <rect
        className={color}
        height={bodyHeight}
        rx="1.5"
        width={bodyWidth}
        x={x - bodyWidth / 2}
        y={bodyY}
      />
    </>
  );
}

function tooltipForMarketPerformanceDay(
  day: ReturnType<typeof joinMarketPerformanceDays>[number],
) {
  return [
    day.tradingDate,
    `Open: ${formatNumber(day.open)}`,
    `High: ${formatNumber(day.high)}`,
    `Low: ${formatNumber(day.low)}`,
    `Close: ${formatNumber(day.close)}`,
    `Range: ${formatNumber(day.range)}`,
    `ATR 14: ${formatNumber(day.atr14)}`,
    `Daily PnL: ${formatCurrency(day.netProfit)}`,
    `Trades: ${day.tradeCount}`,
  ].join("\n");
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
