import {
  calculateDailyMetrics,
  calculateRunMetrics,
  type DailyRunMetric,
  type RunMetrics,
} from "@/lib/analytics";
import {
  type ParsedNinjaTraderSummary,
  parseNinjaTraderSummaryCsv,
} from "@/lib/imports/ninjatrader";

export type ImportPreview = {
  parsed: ParsedNinjaTraderSummary;
  metrics: RunMetrics;
  dailyMetrics: DailyRunMetric[];
  firstTradeRaw: string | null;
  lastTradeRaw: string | null;
  dateRange: {
    first: string | null;
    last: string | null;
  };
  warnings: string[];
};

export function buildImportPreview(
  rawCsv: string,
  sessionStartHour = 18,
): ImportPreview {
  const parsed = parseNinjaTraderSummaryCsv(rawCsv, sessionStartHour);
  const metrics = calculateRunMetrics(parsed.trades);
  const dailyMetrics = calculateDailyMetrics(parsed.trades);
  const firstTrade = parsed.trades[0] ?? null;
  const lastTrade = parsed.trades.at(-1) ?? null;

  return {
    parsed,
    metrics,
    dailyMetrics,
    firstTradeRaw: firstTrade?.closeTimeRaw ?? null,
    lastTradeRaw: lastTrade?.closeTimeRaw ?? null,
    dateRange: {
      first: dailyMetrics[0]?.tradingDate ?? null,
      last: dailyMetrics.at(-1)?.tradingDate ?? null,
    },
    warnings: buildWarnings(parsed, metrics),
  };
}

function buildWarnings(
  parsed: ParsedNinjaTraderSummary,
  metrics: RunMetrics,
): string[] {
  const warnings: string[] = [];
  const finalTrade = parsed.trades.at(-1);
  const finalCumulative = finalTrade?.cumulativeNetProfit ?? 0;
  const missingMaeCount = parsed.trades.filter(
    (trade) => trade.mae === null,
  ).length;
  const missingMfeCount = parsed.trades.filter(
    (trade) => trade.mfe === null,
  ).length;
  const missingEtdCount = parsed.trades.filter(
    (trade) => trade.etd === null,
  ).length;

  if (Math.abs(finalCumulative - metrics.netProfit) > 0.01) {
    warnings.push(
      "Final cumulative net profit does not match the summed trade PnL.",
    );
  }

  if (parsed.trades.every((trade) => trade.commission === 0)) {
    warnings.push("All commission values are zero.");
  }

  if (missingMaeCount > 0) {
    warnings.push(`${missingMaeCount} trades have missing MAE values.`);
  }

  if (missingMfeCount > 0) {
    warnings.push(`${missingMfeCount} trades have missing MFE values.`);
  }

  if (missingEtdCount > 0) {
    warnings.push(`${missingEtdCount} trades have missing ETD values.`);
  }

  if (metrics.winCount === 0) {
    warnings.push("No winning trades were detected.");
  }

  if (metrics.lossCount === 0) {
    warnings.push("No losing trades were detected.");
  }

  return warnings;
}
