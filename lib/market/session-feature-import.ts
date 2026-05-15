import type { MarketSessionFeatureInput } from "@/lib/market/session-features";

export type ParsedSessionFeatureCsv = {
  headers: string[];
  features: MarketSessionFeatureInput[];
};

const dateHeaders = ["date", "tradingdate", "trading_date", "day", "session"];
const referencePriceHeaders = [
  "price",
  "referenceprice",
  "reference_price",
  "open",
  "sessionopen",
  "session_open",
];

export function parseMarketSessionFeatureCsv(
  csv: string,
): ParsedSessionFeatureCsv {
  const rows = parseCsv(csv).filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );

  if (rows.length < 2) {
    throw new Error("CSV must include headers and at least one feature row.");
  }

  const headers = rows[0].map((header) => header.trim());
  const normalizedHeaders = headers.map(normalizeHeader);

  if (findHeaderIndex(normalizedHeaders, dateHeaders) === null) {
    throw new Error("CSV must include a date or trading_date column.");
  }

  const features = rows
    .slice(1)
    .map((row, index) =>
      parseFeatureRow(row, headers, normalizedHeaders, index + 2),
    );

  return {
    features,
    headers,
  };
}

function parseFeatureRow(
  row: string[],
  headers: string[],
  normalizedHeaders: string[],
  rowNumber: number,
): MarketSessionFeatureInput {
  const tradingDate = parseDateValue(
    readAny(row, normalizedHeaders, dateHeaders),
    rowNumber,
  );
  const referencePrice = parseOptionalNumber(
    readAny(row, normalizedHeaders, referencePriceHeaders),
  );
  const openingRange5 = parseOptionalNumber(
    readAny(row, normalizedHeaders, [
      "or5",
      "openingrange5",
      "opening_range_5",
    ]),
  );
  const openingRange10 = parseOptionalNumber(
    readAny(row, normalizedHeaders, [
      "or10",
      "openingrange10",
      "opening_range_10",
    ]),
  );
  const openingRange15 = parseOptionalNumber(
    readAny(row, normalizedHeaders, [
      "or15",
      "openingrange15",
      "opening_range_15",
    ]),
  );
  const closingRange15 = parseOptionalNumber(
    readAny(row, normalizedHeaders, [
      "closerange15",
      "closingrange15",
      "closing_range_15",
      "previousclosingrange15",
      "previous_closing_range_15",
    ]),
  );
  const openingRange5Pct = pctOrDerived(
    row,
    normalizedHeaders,
    ["or5pct", "or5percent", "or5%", "openingrange5pct"],
    openingRange5,
    referencePrice,
  );
  const openingRange10Pct = pctOrDerived(
    row,
    normalizedHeaders,
    ["or10pct", "or10percent", "or10%", "openingrange10pct"],
    openingRange10,
    referencePrice,
  );
  const openingRange15Pct = pctOrDerived(
    row,
    normalizedHeaders,
    ["or15pct", "or15percent", "or15%", "openingrange15pct"],
    openingRange15,
    referencePrice,
  );
  const closingRange15Pct = pctOrDerived(
    row,
    normalizedHeaders,
    [
      "closerange15pct",
      "closerange15percent",
      "closingrange15pct",
      "closingrange15%",
      "closing_range_15_pct",
    ],
    closingRange15,
    referencePrice,
  );

  if (
    [
      openingRange5,
      openingRange5Pct,
      openingRange10,
      openingRange10Pct,
      openingRange15,
      openingRange15Pct,
      closingRange15,
      closingRange15Pct,
    ].every((value) => value === null)
  ) {
    throw new Error(`Row ${rowNumber} does not include any range values.`);
  }

  return {
    closingRange15,
    closingRange15Pct,
    openingRange5,
    openingRange5Pct,
    openingRange10,
    openingRange10Pct,
    openingRange15,
    openingRange15Pct,
    sourceMessage: `Manual CSV import from columns: ${headers.join(", ")}`,
    sourceStatus: "manual",
    tradingDate,
  };
}

function pctOrDerived(
  row: string[],
  normalizedHeaders: string[],
  aliases: string[],
  range: number | null,
  referencePrice: number | null,
) {
  const parsed = parseOptionalPercent(readAny(row, normalizedHeaders, aliases));

  if (parsed !== null) {
    return parsed;
  }

  return range !== null && referencePrice !== null && referencePrice !== 0
    ? range / referencePrice
    : null;
}

function readAny(
  row: string[],
  normalizedHeaders: string[],
  aliases: string[],
) {
  const index = findHeaderIndex(normalizedHeaders, aliases);
  return index === null ? "" : (row[index] ?? "");
}

function findHeaderIndex(normalizedHeaders: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const index = normalizedHeaders.findIndex((header) =>
    normalizedAliases.includes(header),
  );

  return index === -1 ? null : index;
}

function parseDateValue(value: string, rowNumber: number) {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Row ${rowNumber} has an invalid date: ${value}`);
  }

  return parsed.toISOString().slice(0, 10);
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed || trimmed.toLowerCase() === "n/a") {
    return null;
  }

  const parsed = Number(trimmed.replace(/[$,%\s,]/g, ""));

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return parsed;
}

function parseOptionalPercent(value: string) {
  const parsed = parseOptionalNumber(value);

  return parsed === null ? null : parsed / 100;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9%]/g, "");
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
