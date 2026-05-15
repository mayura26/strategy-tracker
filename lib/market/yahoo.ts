import {
  buildSessionFeaturesFromIntradayQuotes,
  type MarketSessionFeatureInput,
} from "@/lib/market/session-features";
import { formatDateKey } from "@/lib/time";

export type MarketBarInput = {
  tradingDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  trueRange: number | null;
  atr14: number | null;
  range: number | null;
  gap: number | null;
};

type YahooBar = {
  date: Date | string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
};

export async function fetchYahooDailyBars(
  symbol: string,
  from: Date,
  to: Date,
): Promise<MarketBarInput[]> {
  const YahooFinance = (await import("yahoo-finance2")).default;
  const yahoo = new YahooFinance();
  const rows = (await yahoo.historical(symbol, {
    period1: from,
    period2: to,
    interval: "1d",
  })) as YahooBar[];

  return enrichBars(rows);
}

export async function fetchYahooIntradaySessionFeatures(
  symbol: string,
  from: Date,
  to: Date,
): Promise<MarketSessionFeatureInput[]> {
  const YahooFinance = (await import("yahoo-finance2")).default;
  const yahoo = new YahooFinance();
  const result = await yahoo.chart(symbol, {
    interval: "5m",
    period1: from,
    period2: to,
  });

  return buildSessionFeaturesFromIntradayQuotes(result.quotes ?? []);
}

export function enrichBars(rows: YahooBar[]): MarketBarInput[] {
  const sorted = [...rows].sort(
    (left, right) =>
      new Date(left.date).getTime() - new Date(right.date).getTime(),
  );
  const trueRanges: number[] = [];
  let previousClose: number | null = null;

  return sorted.map((row) => {
    const high = cleanNumber(row.high);
    const low = cleanNumber(row.low);
    const close = cleanNumber(row.close);
    const open = cleanNumber(row.open);
    const volume = cleanNumber(row.volume);
    const range = high !== null && low !== null ? high - low : null;
    const gap =
      open !== null && previousClose !== null ? open - previousClose : null;
    const trueRange =
      high !== null && low !== null
        ? Math.max(
            high - low,
            previousClose === null ? 0 : Math.abs(high - previousClose),
            previousClose === null ? 0 : Math.abs(low - previousClose),
          )
        : null;

    if (trueRange !== null) {
      trueRanges.push(trueRange);
    }

    const atrWindow = trueRanges.slice(-14);
    const atr14 =
      atrWindow.length === 14
        ? atrWindow.reduce((total, value) => total + value, 0) / 14
        : null;

    if (close !== null) {
      previousClose = close;
    }

    return {
      tradingDate: formatDateKey(new Date(row.date)),
      open,
      high,
      low,
      close,
      volume,
      trueRange,
      atr14,
      range,
      gap,
    };
  });
}

function cleanNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return value;
}
