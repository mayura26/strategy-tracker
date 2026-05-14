"use client";

import {
  type CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  type HistogramData,
  HistogramSeries,
  type IChartApi,
  type LineData,
  LineSeries,
  LineStyle,
  type Time,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";

import type { DailyRunMetric } from "@/lib/analytics";
import type { AnalysisSettings, MarketBar } from "@/lib/db/repository";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { IndicatorRow } from "@/lib/regime-features";

type Props = {
  bars: MarketBar[];
  days: DailyRunMetric[];
  indicatorRows: IndicatorRow[];
  instrumentSymbol: string;
  settings: AnalysisSettings;
};

export function MarketPerformanceChart({
  bars,
  days,
  indicatorRows,
  instrumentSymbol,
  settings,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const data = useMemo(
    () => buildChartData(bars, days, indicatorRows, settings),
    [bars, days, indicatorRows, settings],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container || data.candles.length === 0) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      crosshair: {
        horzLine: { color: "rgba(148, 163, 184, 0.25)" },
        vertLine: { color: "rgba(148, 163, 184, 0.22)" },
      },
      grid: {
        horzLines: { color: "rgba(30, 41, 59, 0.58)" },
        vertLines: { color: "rgba(30, 41, 59, 0.28)" },
      },
      layout: {
        attributionLogo: true,
        background: { color: "#071016", type: ColorType.Solid },
        panes: {
          enableResize: false,
          separatorColor: "rgba(56, 189, 248, 0.18)",
          separatorHoverColor: "rgba(56, 189, 248, 0.28)",
        },
        textColor: "#9fc3dd",
      },
      localization: {
        priceFormatter: (value: number) => formatNumber(value),
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.22)",
        scaleMargins: { bottom: 0.12, top: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.22)",
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 2,
        timeVisible: false,
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        borderDownColor: "#fb7185",
        borderUpColor: "#2dd4bf",
        downColor: "#fb7185",
        wickDownColor: "#fb7185",
        wickUpColor: "#2dd4bf",
        upColor: "#2dd4bf",
      },
      0,
    );
    candleSeries.setData(data.candles);

    chart
      .addSeries(
        LineSeries,
        lineOptions("#f59e0b", `EMA ${settings.emaFastPeriod}`, 2),
        0,
      )
      .setData(data.emaFast);
    chart
      .addSeries(
        LineSeries,
        lineOptions("#38bdf8", `EMA ${settings.emaMidPeriod}`, 2),
        0,
      )
      .setData(data.emaMid);
    chart
      .addSeries(
        LineSeries,
        lineOptions("#c084fc", `EMA ${settings.emaSlowPeriod}`, 2),
        0,
      )
      .setData(data.emaSlow);

    chart
      .addSeries(
        LineSeries,
        lineOptions("#fbbf24", `RSI ${settings.rsiPeriod}`, 2),
        1,
      )
      .setData(data.rsi);
    chart
      .addSeries(
        LineSeries,
        lineOptions("#fb7185", `RSI ${settings.rsiUpperBand}`, 1, true),
        1,
      )
      .setData(data.rsiUpper);
    chart
      .addSeries(
        LineSeries,
        lineOptions("#60a5fa", `RSI ${settings.rsiLowerBand}`, 1, true),
        1,
      )
      .setData(data.rsiLower);

    chart
      .addSeries(
        HistogramSeries,
        {
          base: 0,
          lastValueVisible: false,
          priceFormat: {
            type: "custom",
            formatter: (value: number) => formatCurrency(value),
          },
          priceLineVisible: false,
        },
        2,
      )
      .setData(data.pnl);

    chart.priceScale("right", 1).applyOptions({
      scaleMargins: { bottom: 0.08, top: 0.08 },
    });
    chart.priceScale("right", 2).applyOptions({
      scaleMargins: { bottom: 0.18, top: 0.18 },
    });
    chart.panes()[0]?.setStretchFactor(6);
    chart.panes()[1]?.setStretchFactor(2);
    chart.panes()[2]?.setStretchFactor(2.4);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data, settings]);

  if (data.candles.length === 0) {
    return (
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Instrument chart</h2>
            <p>{instrumentSymbol} market data + daily strategy PnL.</p>
          </div>
        </div>
        <div className="empty-state">
          Refresh market data to unlock instrument chart.
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <h2>Instrument + daily PnL</h2>
          <p>
            {instrumentSymbol} candles with EMA {settings.emaFastPeriod}/
            {settings.emaMidPeriod}/{settings.emaSlowPeriod}, RSI
            {settings.rsiPeriod}, and strategy sessions.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-xs font-semibold">
          <span className="rounded-sm bg-amber-400/12 px-2 py-1 text-amber-200">
            EMA fast
          </span>
          <span className="rounded-sm bg-sky-400/12 px-2 py-1 text-sky-200">
            EMA mid
          </span>
          <span className="rounded-sm bg-fuchsia-400/12 px-2 py-1 text-fuchsia-200">
            EMA slow
          </span>
        </div>
      </div>
      <div
        aria-label={`${instrumentSymbol} candles, RSI, and daily PnL chart`}
        className="h-[660px] overflow-hidden rounded-sm border border-slate-800/80 bg-[#071016]"
        ref={containerRef}
        role="img"
      />
      <div className="quiet-text mt-2 flex flex-wrap justify-between gap-2 text-xs">
        <span>
          ATR{settings.atrPeriod} is derived from cached true range. Daily PnL
          bars use green for profitable sessions and rose for losing sessions.
        </span>
        <a
          className="text-sky-300 hover:text-sky-200"
          href="https://www.tradingview.com/"
          rel="noreferrer"
          target="_blank"
        >
          Charts by TradingView
        </a>
      </div>
    </section>
  );
}

function buildChartData(
  bars: MarketBar[],
  days: DailyRunMetric[],
  indicatorRows: IndicatorRow[],
  settings: AnalysisSettings,
) {
  const completeBars = [...bars]
    .filter(hasCompleteOhlc)
    .sort((left, right) => left.tradingDate.localeCompare(right.tradingDate));
  const indicatorDates = new Set(indicatorRows.map((row) => row.tradingDate));
  const timeline = completeBars.map((bar) => toTime(bar.tradingDate));
  const dailyPnlByDate = new Map(days.map((day) => [day.tradingDate, day]));

  return {
    candles: completeBars.map((bar) => ({
      close: bar.close,
      high: bar.high,
      low: bar.low,
      open: bar.open,
      time: toTime(bar.tradingDate),
    })) satisfies CandlestickData[],
    emaFast: lineData(indicatorRows, "emaFast"),
    emaMid: lineData(indicatorRows, "emaMid"),
    emaSlow: lineData(indicatorRows, "emaSlow"),
    pnl: [...indicatorDates]
      .sort((left, right) => left.localeCompare(right))
      .map((tradingDate) => {
        const day = dailyPnlByDate.get(tradingDate);
        const value = day?.netProfit ?? 0;

        return {
          color:
            value >= 0
              ? "rgba(45, 212, 191, 0.86)"
              : "rgba(251, 113, 133, 0.9)",
          time: toTime(tradingDate),
          value,
        };
      }) satisfies HistogramData[],
    rsi: lineData(indicatorRows, "rsi"),
    rsiLower: referenceLine(timeline, settings.rsiLowerBand),
    rsiUpper: referenceLine(timeline, settings.rsiUpperBand),
  };
}

function lineData(
  rows: IndicatorRow[],
  field: "emaFast" | "emaMid" | "emaSlow" | "rsi",
): LineData[] {
  return rows
    .filter((row) => row[field] !== null)
    .map((row) => ({
      time: toTime(row.tradingDate),
      value: row[field] ?? 0,
    }));
}

function referenceLine(times: Time[], value: number): LineData[] {
  return times.map((time) => ({ time, value }));
}

function lineOptions(
  color: string,
  title: string,
  lineWidth: 1 | 2,
  dashed = false,
) {
  return {
    color,
    lastValueVisible: false,
    lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
    lineWidth,
    priceLineVisible: false,
    title,
  };
}

function hasCompleteOhlc(bar: MarketBar): bar is MarketBar & {
  close: number;
  high: number;
  low: number;
  open: number;
} {
  return (
    bar.open !== null &&
    bar.high !== null &&
    bar.low !== null &&
    bar.close !== null
  );
}

function toTime(tradingDate: string): Time {
  return tradingDate as Time;
}
