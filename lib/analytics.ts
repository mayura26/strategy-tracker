import type { NormalizedTradeSummary } from "@/lib/imports/ninjatrader";

export type RunMetrics = {
  tradeCount: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  winCount: number;
  lossCount: number;
  flatCount: number;
  winRate: number;
  profitFactor: number | null;
  expectancy: number;
  maxDrawdown: number;
  bestTrade: number;
  worstTrade: number;
  avgWin: number;
  avgLoss: number;
  avgMae: number | null;
  avgMfe: number | null;
  avgEtd: number | null;
  firstTradeAt: string | null;
  lastTradeAt: string | null;
};

export type DailyRunMetric = {
  tradingDate: string;
  tradeCount: number;
  netProfit: number;
  cumulativeNetProfit: number;
  winCount: number;
  lossCount: number;
  maxDrawdown: number;
  bestTrade: number;
  worstTrade: number;
  avgMae: number | null;
  avgMfe: number | null;
};

export type GoldenDelta = {
  netProfitDelta: number;
  tradeCountDelta: number;
  winRateDelta: number;
  maxDrawdownDelta: number;
  sharedDays: number;
};

export function calculateRunMetrics(
  trades: NormalizedTradeSummary[],
): RunMetrics {
  if (trades.length === 0) {
    return emptyRunMetrics();
  }

  const wins = trades.filter((trade) => trade.netProfit > 0);
  const losses = trades.filter((trade) => trade.netProfit < 0);
  const grossProfit = sum(wins.map((trade) => trade.netProfit));
  const grossLoss = sum(losses.map((trade) => trade.netProfit));
  const netProfit = sum(trades.map((trade) => trade.netProfit));

  return {
    tradeCount: trades.length,
    netProfit,
    grossProfit,
    grossLoss,
    winCount: wins.length,
    lossCount: losses.length,
    flatCount: trades.length - wins.length - losses.length,
    winRate: wins.length / trades.length,
    profitFactor: grossLoss === 0 ? null : grossProfit / Math.abs(grossLoss),
    expectancy: netProfit / trades.length,
    maxDrawdown: Math.min(
      ...trades.map((trade) => trade.cumulativeMaxDrawdown),
      0,
    ),
    bestTrade: Math.max(...trades.map((trade) => trade.netProfit)),
    worstTrade: Math.min(...trades.map((trade) => trade.netProfit)),
    avgWin: average(wins.map((trade) => trade.netProfit)) ?? 0,
    avgLoss: average(losses.map((trade) => trade.netProfit)) ?? 0,
    avgMae: averagePresent(trades.map((trade) => trade.mae)),
    avgMfe: averagePresent(trades.map((trade) => trade.mfe)),
    avgEtd: averagePresent(trades.map((trade) => trade.etd)),
    firstTradeAt: trades[0]?.closeTimeUtc ?? null,
    lastTradeAt: trades.at(-1)?.closeTimeUtc ?? null,
  };
}

export function calculateDailyMetrics(
  trades: NormalizedTradeSummary[],
): DailyRunMetric[] {
  const groups = new Map<string, NormalizedTradeSummary[]>();

  for (const trade of trades) {
    const group = groups.get(trade.tradingDate) ?? [];
    group.push(trade);
    groups.set(trade.tradingDate, group);
  }

  let cumulativeNetProfit = 0;

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tradingDate, dayTrades]) => {
      const netProfit = sum(dayTrades.map((trade) => trade.netProfit));
      const wins = dayTrades.filter((trade) => trade.netProfit > 0);
      const losses = dayTrades.filter((trade) => trade.netProfit < 0);
      cumulativeNetProfit += netProfit;

      return {
        tradingDate,
        tradeCount: dayTrades.length,
        netProfit,
        cumulativeNetProfit,
        winCount: wins.length,
        lossCount: losses.length,
        maxDrawdown: Math.min(
          ...dayTrades.map((trade) => trade.maxDrawdown),
          0,
        ),
        bestTrade: Math.max(...dayTrades.map((trade) => trade.netProfit)),
        worstTrade: Math.min(...dayTrades.map((trade) => trade.netProfit)),
        avgMae: averagePresent(dayTrades.map((trade) => trade.mae)),
        avgMfe: averagePresent(dayTrades.map((trade) => trade.mfe)),
      };
    });
}

export function calculateGoldenDelta(
  run: RunMetrics,
  golden: RunMetrics | null,
  runDays: DailyRunMetric[],
  goldenDays: DailyRunMetric[],
): GoldenDelta | null {
  if (!golden) {
    return null;
  }

  const goldenDayKeys = new Set(goldenDays.map((day) => day.tradingDate));

  return {
    netProfitDelta: run.netProfit - golden.netProfit,
    tradeCountDelta: run.tradeCount - golden.tradeCount,
    winRateDelta: run.winRate - golden.winRate,
    maxDrawdownDelta: run.maxDrawdown - golden.maxDrawdown,
    sharedDays: runDays.filter((day) => goldenDayKeys.has(day.tradingDate))
      .length,
  };
}

export function buildDistribution(values: number[], bucketCount = 12) {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ start: min, end: max, count: values.length }];
  }

  const width = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    start: min + width * index,
    end: min + width * (index + 1),
    count: 0,
  }));

  for (const value of values) {
    const bucketIndex = Math.min(
      Math.floor((value - min) / width),
      bucketCount - 1,
    );
    buckets[bucketIndex].count += 1;
  }

  return buckets;
}

export function buildDailyPnlDistribution(
  days: DailyRunMetric[],
  bucketCount = 12,
) {
  return buildDistribution(
    days.map((day) => day.netProfit),
    bucketCount,
  );
}

function emptyRunMetrics(): RunMetrics {
  return {
    tradeCount: 0,
    netProfit: 0,
    grossProfit: 0,
    grossLoss: 0,
    winCount: 0,
    lossCount: 0,
    flatCount: 0,
    winRate: 0,
    profitFactor: null,
    expectancy: 0,
    maxDrawdown: 0,
    bestTrade: 0,
    worstTrade: 0,
    avgWin: 0,
    avgLoss: 0,
    avgMae: null,
    avgMfe: null,
    avgEtd: null,
    firstTradeAt: null,
    lastTradeAt: null,
  };
}

function averagePresent(values: Array<number | null>): number | null {
  return average(values.filter((value): value is number => value !== null));
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return sum(values) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
