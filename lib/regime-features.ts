import type { DailyRunMetric } from "@/lib/analytics";
import type { AnalysisSettings, MarketBar } from "@/lib/db/repository";

export type EmaStack = "bullish" | "bearish" | "mixed" | null;
export type EmaCross = "cross-up" | "cross-down" | "none" | null;
export type RsiBand = "below-lower" | "mid-band" | "above-upper" | null;

export type PredictiveRegimeDay = DailyRunMetric & {
  previousTradingDate: string | null;
  previousAtr: number | null;
  previousAtr14: number | null;
  previousRange: number | null;
  previousGap: number | null;
  previousClose: number | null;
  previousReturn: number | null;
  previousTrueRange: number | null;
  previousRsi: number | null;
  previousRsiBand: RsiBand;
  previousEmaFast: number | null;
  previousEmaMid: number | null;
  previousEmaSlow: number | null;
  previousEmaStack: EmaStack;
  previousEmaCrossFastMid: EmaCross;
  previousEmaCrossMidSlow: EmaCross;
  previousEmaCrossFastMidWithinLookback: EmaCross;
  previousEmaCrossMidSlowWithinLookback: EmaCross;
};

export type PredictiveBucketSummary = {
  label: string;
  count: number;
  averagePnl: number | null;
  totalPnl: number;
  winRate: number | null;
  bestDay: number | null;
  worstDay: number | null;
};

export type IndicatorRow = MarketBar & {
  atr: number | null;
  return: number | null;
  rsi: number | null;
  rsiBand: RsiBand;
  emaFast: number | null;
  emaMid: number | null;
  emaSlow: number | null;
  emaStack: EmaStack;
  emaCrossFastMid: EmaCross;
  emaCrossMidSlow: EmaCross;
  emaCrossFastMidWithinLookback: EmaCross;
  emaCrossMidSlowWithinLookback: EmaCross;
};

export function buildPredictiveRegimeDays(
  dailyMetrics: DailyRunMetric[],
  marketBars: MarketBar[],
  settings: AnalysisSettings,
): PredictiveRegimeDay[] {
  const indicatorRows = buildMarketIndicatorRows(marketBars, settings);
  let marketIndex = -1;

  return [...dailyMetrics]
    .sort((left, right) => left.tradingDate.localeCompare(right.tradingDate))
    .map((day) => {
      while (
        marketIndex + 1 < indicatorRows.length &&
        indicatorRows[marketIndex + 1].tradingDate < day.tradingDate
      ) {
        marketIndex += 1;
      }

      const previous = marketIndex >= 0 ? indicatorRows[marketIndex] : null;

      return {
        ...day,
        previousTradingDate: previous?.tradingDate ?? null,
        previousAtr: previous?.atr ?? null,
        previousAtr14: previous?.atr ?? null,
        previousRange: previous?.range ?? null,
        previousGap: previous?.gap ?? null,
        previousClose: previous?.close ?? null,
        previousReturn: previous?.return ?? null,
        previousTrueRange: previous?.trueRange ?? null,
        previousRsi: previous?.rsi ?? null,
        previousRsiBand: previous?.rsiBand ?? null,
        previousEmaFast: previous?.emaFast ?? null,
        previousEmaMid: previous?.emaMid ?? null,
        previousEmaSlow: previous?.emaSlow ?? null,
        previousEmaStack: previous?.emaStack ?? null,
        previousEmaCrossFastMid: previous?.emaCrossFastMid ?? null,
        previousEmaCrossMidSlow: previous?.emaCrossMidSlow ?? null,
        previousEmaCrossFastMidWithinLookback:
          previous?.emaCrossFastMidWithinLookback ?? null,
        previousEmaCrossMidSlowWithinLookback:
          previous?.emaCrossMidSlowWithinLookback ?? null,
      };
    });
}

export function buildMarketIndicatorRows(
  marketBars: MarketBar[],
  settings: AnalysisSettings,
): IndicatorRow[] {
  const sortedBars = [...marketBars].sort((left, right) =>
    left.tradingDate.localeCompare(right.tradingDate),
  );
  const closes = sortedBars.map((bar) => bar.close);
  const emaFast = calculateEmaValues(closes, settings.emaFastPeriod);
  const emaMid = calculateEmaValues(closes, settings.emaMidPeriod);
  const emaSlow = calculateEmaValues(closes, settings.emaSlowPeriod);
  const rsi = calculateRsiValues(closes, settings.rsiPeriod);
  const atr = calculateAtrValues(
    sortedBars.map((bar) => bar.trueRange),
    settings.atrPeriod,
  );

  const baseRows = sortedBars.map((bar, index) => {
    const previousBar = index > 0 ? sortedBars[index - 1] : null;
    const returnValue =
      previousBar !== null &&
      bar.close !== null &&
      previousBar.close !== null &&
      previousBar.close !== 0
        ? (bar.close - previousBar.close) / previousBar.close
        : null;
    const stack = classifyEmaStack(
      emaFast[index],
      emaMid[index],
      emaSlow[index],
    );

    return {
      ...bar,
      atr: atr[index],
      return: returnValue,
      rsi: rsi[index],
      rsiBand: classifyRsiBand(
        rsi[index],
        settings.rsiLowerBand,
        settings.rsiUpperBand,
      ),
      emaFast: emaFast[index],
      emaMid: emaMid[index],
      emaSlow: emaSlow[index],
      emaStack: stack,
      emaCrossFastMid:
        index > 0
          ? classifyEmaCross(
              emaFast[index - 1],
              emaMid[index - 1],
              emaFast[index],
              emaMid[index],
            )
          : null,
      emaCrossMidSlow:
        index > 0
          ? classifyEmaCross(
              emaMid[index - 1],
              emaSlow[index - 1],
              emaMid[index],
              emaSlow[index],
            )
          : null,
      emaCrossFastMidWithinLookback: null,
      emaCrossMidSlowWithinLookback: null,
    };
  });

  return baseRows.map((row, index) => ({
    ...row,
    emaCrossFastMidWithinLookback: findCrossWithinLookback(
      baseRows.map((item) => item.emaCrossFastMid),
      index,
      settings.emaCrossLookbackDays,
    ),
    emaCrossMidSlowWithinLookback: findCrossWithinLookback(
      baseRows.map((item) => item.emaCrossMidSlow),
      index,
      settings.emaCrossLookbackDays,
    ),
  }));
}

export function calculateEmaValues(
  values: Array<number | null>,
  period: number,
): Array<number | null> {
  const multiplier = 2 / (period + 1);
  let previousEma: number | null = null;

  return values.map((value) => {
    if (value === null || !Number.isFinite(value)) {
      return null;
    }

    previousEma =
      previousEma === null
        ? value
        : value * multiplier + previousEma * (1 - multiplier);

    return previousEma;
  });
}

export function calculateRsiValues(
  values: Array<number | null>,
  period: number,
): Array<number | null> {
  const output: Array<number | null> = Array.from(
    { length: values.length },
    () => null,
  );
  let previousClose: number | null = null;
  let averageGain: number | null = null;
  let averageLoss: number | null = null;
  const gains: number[] = [];
  const losses: number[] = [];

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      return;
    }

    if (previousClose === null) {
      previousClose = value;
      return;
    }

    const change = value - previousClose;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (averageGain === null || averageLoss === null) {
      gains.push(gain);
      losses.push(loss);

      if (gains.length === period) {
        averageGain = average(gains);
        averageLoss = average(losses);
        output[index] = rsiFromAverages(averageGain, averageLoss);
      }
    } else {
      averageGain = (averageGain * (period - 1) + gain) / period;
      averageLoss = (averageLoss * (period - 1) + loss) / period;
      output[index] = rsiFromAverages(averageGain, averageLoss);
    }

    previousClose = value;
  });

  return output;
}

export function calculateAtrValues(
  values: Array<number | null>,
  period: number,
): Array<number | null> {
  const output: Array<number | null> = Array.from(
    { length: values.length },
    () => null,
  );
  const window: number[] = [];

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      return;
    }

    window.push(value);

    if (window.length > period) {
      window.shift();
    }

    if (window.length === period) {
      output[index] = average(window);
    }
  });

  return output;
}

export function classifyEmaStack(
  fast: number | null,
  mid: number | null,
  slow: number | null,
): EmaStack {
  if (fast === null || mid === null || slow === null) {
    return null;
  }

  if (fast > mid && mid > slow) {
    return "bullish";
  }

  if (fast < mid && mid < slow) {
    return "bearish";
  }

  return "mixed";
}

export function classifyEmaCross(
  previousFast: number | null,
  previousSlow: number | null,
  fast: number | null,
  slow: number | null,
): EmaCross {
  if (
    previousFast === null ||
    previousSlow === null ||
    fast === null ||
    slow === null
  ) {
    return null;
  }

  if (previousFast <= previousSlow && fast > slow) {
    return "cross-up";
  }

  if (previousFast >= previousSlow && fast < slow) {
    return "cross-down";
  }

  return "none";
}

export function classifyRsiBand(
  rsi: number | null,
  lowerBand: number,
  upperBand: number,
): RsiBand {
  if (rsi === null) {
    return null;
  }

  if (rsi < lowerBand) {
    return "below-lower";
  }

  if (rsi > upperBand) {
    return "above-upper";
  }

  return "mid-band";
}

export function findCrossWithinLookback(
  crosses: EmaCross[],
  index: number,
  lookbackDays: number,
): EmaCross {
  const startIndex = Math.max(0, index - lookbackDays + 1);

  for (let cursor = index; cursor >= startIndex; cursor -= 1) {
    const cross = crosses[cursor];

    if (cross === "cross-up" || cross === "cross-down") {
      return cross;
    }
  }

  return "none";
}

export function summarizePredictiveThreshold(
  days: PredictiveRegimeDay[],
  field: "previousAtr" | "previousRsi",
  threshold: number,
  label?: string,
) {
  const eligibleDays = days.filter((day) => day[field] !== null);
  const fieldLabel = label ?? labelForField(field);

  return {
    above: summarizeBucket(
      `${fieldLabel} >= ${threshold}`,
      eligibleDays.filter((day) => (day[field] ?? 0) >= threshold),
    ),
    below: summarizeBucket(
      `${fieldLabel} < ${threshold}`,
      eligibleDays.filter((day) => (day[field] ?? 0) < threshold),
    ),
  };
}

export function summarizePredictiveRsiBands(
  days: PredictiveRegimeDay[],
  lowerBand: number,
) {
  const normalizedLower = Math.max(0, Math.min(lowerBand, 49));
  const upperBand = 100 - normalizedLower;
  const eligibleDays = days.filter((day) => day.previousRsi !== null);

  return [
    summarizeBucket(
      `Previous RSI < ${normalizedLower}`,
      eligibleDays.filter(
        (day) =>
          classifyRsiBand(day.previousRsi, normalizedLower, upperBand) ===
          "below-lower",
      ),
    ),
    summarizeBucket(
      `Previous RSI ${normalizedLower}-${upperBand}`,
      eligibleDays.filter(
        (day) =>
          classifyRsiBand(day.previousRsi, normalizedLower, upperBand) ===
          "mid-band",
      ),
    ),
    summarizeBucket(
      `Previous RSI > ${upperBand}`,
      eligibleDays.filter(
        (day) =>
          classifyRsiBand(day.previousRsi, normalizedLower, upperBand) ===
          "above-upper",
      ),
    ),
  ];
}

export function summarizePredictiveCategory(
  days: PredictiveRegimeDay[],
  field:
    | "previousEmaStack"
    | "previousEmaCrossFastMid"
    | "previousEmaCrossMidSlow"
    | "previousEmaCrossFastMidWithinLookback"
    | "previousEmaCrossMidSlowWithinLookback"
    | "previousRsiBand",
) {
  const eligibleDays = days.filter((day) => day[field] !== null);
  const values = [
    ...new Set(
      eligibleDays
        .map((day) => day[field])
        .filter((value) => value !== null)
        .map(String),
    ),
  ];

  return values.map((value) =>
    summarizeBucket(
      value,
      eligibleDays.filter((day) => day[field] === value),
    ),
  );
}

function summarizeBucket(
  label: string,
  days: PredictiveRegimeDay[],
): PredictiveBucketSummary {
  const totalPnl = days.reduce((sum, day) => sum + day.netProfit, 0);

  return {
    label,
    count: days.length,
    averagePnl: days.length === 0 ? null : totalPnl / days.length,
    totalPnl,
    winRate:
      days.length === 0
        ? null
        : days.filter((day) => day.netProfit > 0).length / days.length,
    bestDay: days.length === 0 ? null : Math.max(...days.map(dayPnl)),
    worstDay: days.length === 0 ? null : Math.min(...days.map(dayPnl)),
  };
}

function dayPnl(day: PredictiveRegimeDay) {
  return day.netProfit;
}

function rsiFromAverages(averageGain: number, averageLoss: number) {
  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function labelForField(field: "previousAtr" | "previousRsi") {
  return field === "previousAtr" ? "Previous ATR" : "Previous RSI";
}
