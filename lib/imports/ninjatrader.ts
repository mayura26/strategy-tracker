import { ntDateToIso, tradingDateFromNtPeriod } from "@/lib/time";

export const NINJATRADER_SUMMARY_PROFILE = "ninjatrader-strategy-summary-v1";

export type NormalizedTradeSummary = {
  tradeNumber: number;
  closeTimeRaw: string;
  closeTimeUtc: string;
  tradingDate: string;
  cumulativeNetProfit: number;
  netProfit: number;
  commission: number;
  cumulativeMaxDrawdown: number;
  maxDrawdown: number;
  mae: number | null;
  mfe: number | null;
  etd: number | null;
};

export type ParsedNinjaTraderSummary = {
  profile: typeof NINJATRADER_SUMMARY_PROFILE;
  rowCount: number;
  headers: string[];
  trades: NormalizedTradeSummary[];
};

const requiredHeaders = [
  "Period",
  "#",
  "Cum. net profit",
  "Net profit",
  "Commission",
  "Cum. max. drawdown",
  "Max. drawdown",
  "Avg. MAE",
  "Avg. MFE",
  "Avg. ETD",
];

export function parseNinjaTraderSummaryCsv(
  csv: string,
  sessionStartHour = 18,
): ParsedNinjaTraderSummary {
  const rows = parseCsv(csv).filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );

  if (rows.length < 2) {
    throw new Error(
      "CSV must include a header row and at least one trade row.",
    );
  }

  const headers = rows[0].map((header) => header.trim()).filter(Boolean);
  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header),
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required NT columns: ${missingHeaders.join(", ")}`,
    );
  }

  const trades = rows.slice(1).map((row, index) => {
    const record = toRecord(headers, row);
    const period = value(record, "Period");

    return {
      tradeNumber: parseInteger(value(record, "#"), index + 1),
      closeTimeRaw: period,
      closeTimeUtc: ntDateToIso(period),
      tradingDate: tradingDateFromNtPeriod(period, sessionStartHour),
      cumulativeNetProfit: parseCurrency(value(record, "Cum. net profit")) ?? 0,
      netProfit: parseCurrency(value(record, "Net profit")) ?? 0,
      commission: parseCurrency(value(record, "Commission")) ?? 0,
      cumulativeMaxDrawdown:
        parseCurrency(value(record, "Cum. max. drawdown")) ?? 0,
      maxDrawdown: parseCurrency(value(record, "Max. drawdown")) ?? 0,
      mae: parseCurrency(value(record, "Avg. MAE")),
      mfe: parseCurrency(value(record, "Avg. MFE")),
      etd: parseCurrency(value(record, "Avg. ETD")),
    };
  });

  validateTradeSequence(trades);

  return {
    profile: NINJATRADER_SUMMARY_PROFILE,
    rowCount: trades.length,
    headers,
    trades,
  };
}

export function parseCurrency(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed || trimmed.toLowerCase() === "n/a") {
    return null;
  }

  const negative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const normalized = trimmed.replace(/[$,%(),\s]/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid currency value: ${value}`);
  }

  return negative ? -parsed : parsed;
}

function parseInteger(value: string, fallback: number): number {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) ? parsed : fallback;
}

function value(record: Record<string, string>, key: string): string {
  const found = record[key];

  if (found === undefined) {
    throw new Error(`Missing value for ${key}`);
  }

  return found;
}

function toRecord(headers: string[], row: string[]): Record<string, string> {
  return Object.fromEntries(
    headers.map((header, index) => [header, row[index]?.trim() ?? ""]),
  );
}

function validateTradeSequence(trades: NormalizedTradeSummary[]) {
  trades.forEach((trade, index) => {
    if (trade.tradeNumber !== index + 1) {
      throw new Error(
        `Unexpected trade number ${trade.tradeNumber}; expected ${index + 1}.`,
      );
    }
  });
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
