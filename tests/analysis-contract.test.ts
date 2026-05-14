import {
  buildLocalRegimeDiscoveryResult,
  buildRegimeDiscoverySnapshot,
} from "@/lib/analysis-contract";
import type { RunDetail } from "@/lib/db/repository";
import type { PredictiveRegimeDay } from "@/lib/regime-features";
import { assertEqual, assertOk } from "./assert";

function runAnalysisContractTests() {
  const run = fakeRun();
  const predictiveDays = [fakePredictiveDay("2026-01-03", 125)];
  const snapshot = buildRegimeDiscoverySnapshot(
    run,
    predictiveDays,
    "2026-02-01T00:00:00.000Z",
  );

  assertEqual(snapshot.jobType, "regime-discovery");
  assertEqual(snapshot.runs[0].runId, "run-1");
  assertEqual((snapshot.runs[0].settings as { mode: string }).mode, "test");
  assertEqual(snapshot.trades[0].runId, "run-1");
  assertEqual(snapshot.dailyMetrics[0].runId, "run-1");
  assertEqual(snapshot.marketBars[0].instrument, "ES");
  assertEqual(snapshot.predictiveDays[0].previousTradingDate, "2026-01-02");

  const result = buildLocalRegimeDiscoveryResult("Test run", [
    {
      action: "favor",
      condition: "Previous ATR5 >= 20.00",
      feature: "Previous ATR5",
      key: "atr",
      lift: 75,
      otherAveragePnl: 25,
      otherCount: 4,
      selectedAveragePnl: 100,
      selectedCount: 5,
      selectedTotalPnl: 500,
      selectedWinRate: 0.8,
      threshold: 20,
      validated: true,
      validationAveragePnl: 80,
      validationCount: 2,
      validationLift: 40,
      validationOtherAveragePnl: 40,
      validationWinRate: 1,
    },
  ]);

  assertEqual(result.source, "local-heuristic");
  assertEqual(result.factors.length, 1);
  assertOk(
    result.artifacts[0].content.includes("Previous ATR5"),
    "analysis report contains factor",
  );
}

runAnalysisContractTests();

console.log("Analysis contract tests passed.");

function fakeRun(): RunDetail {
  return {
    botId: "bot-1",
    botModeName: "Mode A",
    botName: "Grid",
    coverageEndDate: "2026-01-03",
    coverageStartDate: "2026-01-03",
    createdAt: "2026-02-01T00:00:00.000Z",
    dailyMetrics: [fakePredictiveDay("2026-01-03", 125)],
    expectancy: 125,
    firstTradeAt: "2026-01-03T14:00:00.000Z",
    goldenRun: null,
    id: "run-1",
    importInfo: null,
    instrumentId: "instrument-1",
    instrumentSymbol: "ES",
    isGolden: false,
    lastTradeAt: "2026-01-03T15:00:00.000Z",
    marketBars: [
      {
        atr14: 22,
        close: 5010,
        gap: 4,
        high: 5020,
        low: 4990,
        open: 5000,
        range: 30,
        sourceStatus: "ok",
        tradingDate: "2026-01-02",
        trueRange: 35,
        volume: 1000,
      },
    ],
    maxDrawdown: -40,
    name: "Test run",
    netProfit: 125,
    notes: "",
    profitFactor: 2,
    settingsJson: '{"mode":"test"}',
    tags: "test",
    timeframe: "5m",
    tradeCount: 1,
    trades: [
      {
        closeTimeRaw: "1/3/2026 9:00 AM",
        closeTimeUtc: "2026-01-03T14:00:00.000Z",
        commission: 0,
        cumulativeMaxDrawdown: -40,
        cumulativeNetProfit: 125,
        etd: 20,
        mae: 10,
        maxDrawdown: -40,
        mfe: 145,
        netProfit: 125,
        tradeNumber: 1,
        tradingDate: "2026-01-03",
      },
    ],
    winRate: 1,
    yahooSymbol: "ES=F",
  };
}

function fakePredictiveDay(
  tradingDate: string,
  netProfit: number,
): PredictiveRegimeDay {
  return {
    avgMae: 10,
    avgMfe: 145,
    bestTrade: netProfit,
    cumulativeNetProfit: netProfit,
    lossCount: 0,
    maxDrawdown: -40,
    netProfit,
    previousAtr14: 22,
    previousAtr: 22,
    previousClose: 5010,
    previousEmaCrossFastMid: "cross-up",
    previousEmaCrossFastMidWithinLookback: "cross-up",
    previousEmaCrossMidSlow: "none",
    previousEmaCrossMidSlowWithinLookback: "none",
    previousEmaFast: 5005,
    previousEmaMid: 5000,
    previousEmaSlow: 4990,
    previousEmaStack: "bullish",
    previousGap: 4,
    previousRange: 30,
    previousReturn: 0.01,
    previousRsi: 55,
    previousRsiBand: "mid-band",
    previousTradingDate: "2026-01-02",
    previousTrueRange: 35,
    tradeCount: 1,
    tradingDate,
    winCount: 1,
    worstTrade: netProfit,
  };
}
