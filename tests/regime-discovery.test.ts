import { discoverRegimeThresholds } from "@/lib/regime-discovery";
import { assertEqual, assertOk } from "@/tests/assert";

const days = Array.from({ length: 20 }, (_, index) => {
  const highAtr = index % 2 === 0;

  return {
    tradingDate: `2026-01-${String(index + 1).padStart(2, "0")}`,
    tradeCount: 1,
    netProfit: highAtr ? 300 : -50,
    cumulativeNetProfit: 0,
    winCount: highAtr ? 1 : 0,
    lossCount: highAtr ? 0 : 1,
    maxDrawdown: highAtr ? 0 : -50,
    bestTrade: highAtr ? 300 : -50,
    worstTrade: highAtr ? 300 : -50,
    avgMae: null,
    avgMfe: null,
    atr14: highAtr ? 40 + index : 10 + index,
    range: highAtr ? 55 + index : 15 + index,
    gap: index % 2 === 0 ? 1 : -1,
  };
});

const suggestions = discoverRegimeThresholds(days, { minDays: 4, limit: 4 });
const topSuggestion = suggestions[0];

assertOk(suggestions.length > 0, "threshold suggestions created");
assertEqual(topSuggestion.action, "favor", "top threshold action");
assertOk(topSuggestion.lift > 0, "top threshold lift is positive");
assertOk(
  topSuggestion.condition.includes("ATR 14") ||
    topSuggestion.condition.includes("Range"),
  "top threshold uses volatility feature",
);
assertOk(
  topSuggestion.selectedAveragePnl > topSuggestion.otherAveragePnl,
  "selected regime beats remainder",
);
assertOk(topSuggestion.validated, "top threshold validates out of sample");
assertOk(
  (topSuggestion.validationLift ?? 0) > 0,
  "validation lift is positive",
);

console.log("Regime discovery tests passed.");
