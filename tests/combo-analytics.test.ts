import {
  buildWeightedCombo,
  weightsFromComboConfig,
} from "@/lib/combo-analytics";
import type { ComboSourceRun } from "@/lib/db/repository";
import { assertApprox, assertEqual } from "@/tests/assert";

const runs: ComboSourceRun[] = [
  run("run-a", "Run A", [
    day("2026-01-01", 100),
    day("2026-01-02", -50),
    day("2026-01-03", 25),
  ]),
  run("run-b", "Run B", [
    day("2026-01-01", -20),
    day("2026-01-02", 100),
    day("2026-01-04", 40),
  ]),
];

const weights = weightsFromComboConfig([
  { runId: "run-a", weight: 1 },
  { runId: "run-b", weight: 2 },
]);
const combo = buildWeightedCombo(runs, weights);

assertEqual(combo.days.length, 4, "combo date union");
assertEqual(combo.netProfit, 315, "combo net pnl");
assertEqual(combo.mixedDays, 2, "combo mixed days");
assertEqual(combo.allWinDays, 0, "combo all win days");
assertEqual(combo.topDays[0].tradingDate, "2026-01-02", "combo top day");
assertApprox(combo.winDayRate, 1, "combo win day rate");

console.log("Combo analytics tests passed.");

function run(
  id: string,
  name: string,
  dailyMetrics: ComboSourceRun["dailyMetrics"],
): ComboSourceRun {
  return {
    id,
    name,
    botName: "Tempest",
    botModeName: "Cyclone",
    instrumentSymbol: "SIL",
    yahooSymbol: "SI=F",
    timeframe: "5m",
    tags: "",
    tradeCount: dailyMetrics.length,
    netProfit: dailyMetrics.reduce((sum, metric) => sum + metric.netProfit, 0),
    maxDrawdown: 0,
    winRate: 0,
    profitFactor: null,
    expectancy: 0,
    firstTradeAt: null,
    lastTradeAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    isGolden: false,
    dailyMetrics,
  };
}

function day(tradingDate: string, netProfit: number) {
  return {
    tradingDate,
    tradeCount: 1,
    netProfit,
    cumulativeNetProfit: netProfit,
    winCount: netProfit > 0 ? 1 : 0,
    lossCount: netProfit < 0 ? 1 : 0,
    maxDrawdown: Math.min(netProfit, 0),
    bestTrade: netProfit,
    worstTrade: netProfit,
    avgMae: null,
    avgMfe: null,
  };
}
