import { buildSessionFeaturesFromIntradayQuotes } from "@/lib/market/session-features";
import { assertApprox, assertEqual } from "@/tests/assert";

const features = buildSessionFeaturesFromIntradayQuotes([
  quote("2026-03-10T13:30:00.000Z", 20_000, 20_100, 20_000),
  quote("2026-03-10T13:35:00.000Z", 20_080, 20_120, 19_980),
  quote("2026-03-10T13:40:00.000Z", 20_050, 20_200, 19_950),
  quote("2026-03-10T19:45:00.000Z", 20_020, 20_050, 19_990),
  quote("2026-03-10T19:50:00.000Z", 20_030, 20_060, 19_980),
  quote("2026-03-10T19:55:00.000Z", 20_040, 20_070, 20_000),
]);

assertEqual(features.length, 1, "session feature row created");
assertEqual(features[0].tradingDate, "2026-03-10", "uses New York date");
assertEqual(features[0].openingRange5, 100, "OR5 point range");
assertApprox(features[0].openingRange5Pct ?? 0, 0.005, "OR5 percent");
assertEqual(features[0].openingRange10, 140, "OR10 point range");
assertApprox(features[0].openingRange10Pct ?? 0, 0.007, "OR10 percent");
assertEqual(features[0].openingRange15, 250, "OR15 point range");
assertApprox(features[0].openingRange15Pct ?? 0, 0.0125, "OR15 percent");
assertEqual(features[0].closingRange15, 90, "closing range point range");
assertApprox(
  features[0].closingRange15Pct ?? 0,
  90 / 20_020,
  "closing range percent",
);
assertEqual(features[0].sourceStatus, "ok", "complete windows are ok");

console.log("Market session feature tests passed.");

function quote(date: string, open: number, high: number, low: number) {
  return {
    close: open,
    date,
    high,
    low,
    open,
    volume: 100,
  };
}
