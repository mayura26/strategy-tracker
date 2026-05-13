import { readFileSync } from "node:fs";
import { join } from "node:path";

import { calculateDailyMetrics, calculateRunMetrics } from "@/lib/analytics";
import {
  parseCurrency,
  parseNinjaTraderSummaryCsv,
} from "@/lib/imports/ninjatrader";
import { tradingDateFromNtPeriod } from "@/lib/time";
import { assertEqual, assertOk } from "@/tests/assert";

const fixture = readFileSync(
  join(process.cwd(), "examples", "NinjaTrader Grid 2026-05-12 02-34 AM.csv"),
  "utf8",
);

const parsed = parseNinjaTraderSummaryCsv(fixture);
const runMetrics = calculateRunMetrics(parsed.trades);
const dailyMetrics = calculateDailyMetrics(parsed.trades);

assertEqual(parsed.rowCount, 210, "row count");
assertEqual(parsed.trades[0].tradeNumber, 1, "first trade number");
assertEqual(parsed.trades[0].netProfit, -120, "first net profit");
assertEqual(parsed.trades[0].cumulativeNetProfit, -120, "first equity");
assertEqual(parsed.trades[0].mae, 120, "first MAE");
assertEqual(parsed.trades.at(-1)?.tradeNumber, 210, "last trade number");
assertEqual(parsed.trades.at(-1)?.netProfit, -100, "last net profit");

assertEqual(parseCurrency("$1,234.50"), 1234.5, "currency with comma");
assertEqual(parseCurrency("-$120.00"), -120, "negative currency");
assertEqual(parseCurrency("($42.25)"), -42.25, "parenthetical currency");
assertEqual(parseCurrency("n/a"), null, "n/a currency");

assertEqual(
  tradingDateFromNtPeriod("2026-02-22 9:25 PM"),
  "2026-02-23",
  "evening session rolls forward",
);
assertEqual(
  tradingDateFromNtPeriod("2026-02-25 12:02 AM"),
  "2026-02-25",
  "after-midnight session remains same trading date",
);

assertEqual(runMetrics.tradeCount, 210, "run trade count");
assertEqual(runMetrics.netProfit, 15485, "run net profit");
assertEqual(runMetrics.winCount, 96, "run wins");
assertEqual(runMetrics.lossCount, 114, "run losses");
assertOk(runMetrics.maxDrawdown <= 0, "drawdown is negative or flat");
assertOk(dailyMetrics.length > 40, "daily metrics were created");
assertEqual(
  dailyMetrics.at(-1)?.cumulativeNetProfit,
  15485,
  "daily cumulative PnL",
);

console.log("NinjaTrader importer tests passed.");
