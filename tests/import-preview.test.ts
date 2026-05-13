import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildImportPreview } from "@/lib/import-preview";
import { assertEqual, assertOk } from "@/tests/assert";

const fixture = readFileSync(
  join(process.cwd(), "examples", "NinjaTrader Grid 2026-05-12 02-34 AM.csv"),
  "utf8",
);

const preview = buildImportPreview(fixture);

assertEqual(preview.parsed.rowCount, 210, "preview row count");
assertEqual(preview.metrics.netProfit, 15485, "preview net pnl");
assertEqual(preview.firstTradeRaw, "2026-02-22 9:25 PM", "first trade raw");
assertEqual(preview.lastTradeRaw, "2026-05-07 9:28 PM", "last trade raw");
assertEqual(preview.dateRange.first, "2026-02-23", "preview first day");
assertEqual(preview.dateRange.last, "2026-05-08", "preview last day");
assertEqual(
  preview.dailyMetrics.at(-1)?.cumulativeNetProfit,
  15485,
  "preview final daily cumulative pnl",
);

const missingValuePreview =
  buildImportPreview(`Period,#,Cum. net profit,Net profit,Commission,Cum. max. drawdown,Max. drawdown,Avg. MAE,Avg. MFE,Avg. ETD
2026-01-01 10:00 AM,1,$10.00,$10.00,$0.00,$0.00,$0.00,n/a,n/a,n/a`);

assertOk(
  missingValuePreview.warnings.includes("All commission values are zero."),
  "preview warns on zero commissions",
);
assertOk(
  missingValuePreview.warnings.includes("1 trades have missing MAE values."),
  "preview warns on missing MAE",
);
assertOk(
  missingValuePreview.warnings.includes("No losing trades were detected."),
  "preview warns on no losing trades",
);

console.log("Import preview tests passed.");
