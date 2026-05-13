import type { DailyRunMetric } from "@/lib/analytics";
import type { MarketBar } from "@/lib/db/repository";

export type JoinedMarketPerformanceDay = DailyRunMetric & {
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  range: number | null;
  atr14: number | null;
  gap: number | null;
  hasCompleteOhlc: boolean;
};

export function joinMarketPerformanceDays(
  dailyMetrics: DailyRunMetric[],
  marketBars: MarketBar[],
): JoinedMarketPerformanceDay[] {
  const barsByDate = new Map(marketBars.map((bar) => [bar.tradingDate, bar]));

  return dailyMetrics
    .map((day) => {
      const bar = barsByDate.get(day.tradingDate);

      if (!bar) {
        return null;
      }

      return {
        ...day,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        range: bar.range,
        atr14: bar.atr14,
        gap: bar.gap,
        hasCompleteOhlc:
          bar.open !== null &&
          bar.high !== null &&
          bar.low !== null &&
          bar.close !== null,
      };
    })
    .filter((day): day is JoinedMarketPerformanceDay => day !== null)
    .sort((left, right) => left.tradingDate.localeCompare(right.tradingDate));
}
