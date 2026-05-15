import { parseMarketSessionFeatureCsv } from "@/lib/market/session-feature-import";
import { assertApprox, assertEqual } from "@/tests/assert";

const parsed =
  parseMarketSessionFeatureCsv(`date,price,or5,or10,or15,closeRange15
2026-03-16,20000,100,160,220,75
2026-03-17,21000,0,105,210,0`);

assertEqual(parsed.features.length, 2, "manual session features parsed");
assertEqual(parsed.features[0].tradingDate, "2026-03-16", "date parsed");
assertEqual(parsed.features[0].openingRange5, 100, "OR5 points parsed");
assertApprox(
  parsed.features[0].openingRange5Pct ?? 0,
  0.005,
  "OR5 percent derived from price",
);
assertApprox(
  parsed.features[0].closingRange15Pct ?? 0,
  0.00375,
  "closing range percent derived from price",
);
assertEqual(parsed.features[0].sourceStatus, "manual", "manual source marked");

const explicitPct = parseMarketSessionFeatureCsv(`trading_date,or5%,or15%
2026-03-18,0.5%,1.25`);

assertApprox(
  explicitPct.features[0].openingRange5Pct ?? 0,
  0.005,
  "percent sign parses",
);
assertApprox(
  explicitPct.features[0].openingRange15Pct ?? 0,
  0.0125,
  "plain percent parses",
);

console.log("Market session feature import tests passed.");
