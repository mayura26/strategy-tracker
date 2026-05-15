export type IntradayQuote = {
  date: Date | string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
};

export type MarketSessionFeatureInput = {
  tradingDate: string;
  openingRange5: number | null;
  openingRange5Pct: number | null;
  openingRange10: number | null;
  openingRange10Pct: number | null;
  openingRange15: number | null;
  openingRange15Pct: number | null;
  closingRange15: number | null;
  closingRange15Pct: number | null;
  sourceStatus: string;
  sourceMessage: string | null;
};

type SessionQuote = {
  tradingDate: string;
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
};

const easternFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: "America/New_York",
  year: "numeric",
});

export function buildSessionFeaturesFromIntradayQuotes(
  quotes: IntradayQuote[],
): MarketSessionFeatureInput[] {
  const byDate = new Map<string, SessionQuote[]>();

  for (const quote of quotes) {
    const normalized = normalizeQuote(quote);

    if (!normalized) {
      continue;
    }

    const rows = byDate.get(normalized.tradingDate) ?? [];
    rows.push(normalized);
    byDate.set(normalized.tradingDate, rows);
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tradingDate, rows]) => {
      const sortedRows = rows.sort((left, right) =>
        left.time.localeCompare(right.time),
      );
      const openingRange5 = calculateWindowRange(sortedRows, "09:30", "09:35");
      const openingRange10 = calculateWindowRange(sortedRows, "09:30", "09:40");
      const openingRange15 = calculateWindowRange(sortedRows, "09:30", "09:45");
      const closingRange15 = calculateWindowRange(sortedRows, "15:45", "16:00");
      const hasAllOpeningRanges =
        openingRange5.range !== null &&
        openingRange10.range !== null &&
        openingRange15.range !== null;
      const hasClosingRange = closingRange15.range !== null;

      return {
        tradingDate,
        openingRange5: openingRange5.range,
        openingRange5Pct: openingRange5.percent,
        openingRange10: openingRange10.range,
        openingRange10Pct: openingRange10.percent,
        openingRange15: openingRange15.range,
        openingRange15Pct: openingRange15.percent,
        closingRange15: closingRange15.range,
        closingRange15Pct: closingRange15.percent,
        sourceStatus: hasAllOpeningRanges && hasClosingRange ? "ok" : "partial",
        sourceMessage:
          hasAllOpeningRanges && hasClosingRange
            ? null
            : "Yahoo intraday data did not include every requested session window.",
      };
    });
}

function normalizeQuote(quote: IntradayQuote): SessionQuote | null {
  const date = quote.date instanceof Date ? quote.date : new Date(quote.date);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = Object.fromEntries(
    easternFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const tradingDate = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;

  return {
    tradingDate,
    time,
    open: cleanNumber(quote.open),
    high: cleanNumber(quote.high),
    low: cleanNumber(quote.low),
    close: cleanNumber(quote.close),
  };
}

function calculateWindowRange(
  rows: SessionQuote[],
  startTime: string,
  endTime: string,
) {
  const windowRows = rows.filter(
    (row) => row.time >= startTime && row.time < endTime,
  );
  const highs = windowRows
    .map((row) => row.high)
    .filter((value): value is number => value !== null);
  const lows = windowRows
    .map((row) => row.low)
    .filter((value): value is number => value !== null);
  const referencePrice =
    windowRows.find((row) => row.open !== null)?.open ??
    windowRows.find((row) => row.close !== null)?.close ??
    null;

  if (highs.length === 0 || lows.length === 0) {
    return { percent: null, range: null };
  }

  const range = Math.max(...highs) - Math.min(...lows);

  return {
    percent:
      referencePrice !== null && referencePrice !== 0
        ? range / referencePrice
        : null,
    range,
  };
}

function cleanNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return value;
}
