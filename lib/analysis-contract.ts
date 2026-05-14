import type { DailyRunMetric } from "@/lib/analytics";
import type { MarketBar, RunDetail } from "@/lib/db/repository";
import type { NormalizedTradeSummary } from "@/lib/imports/ninjatrader";
import type { ThresholdSuggestion } from "@/lib/regime-discovery";
import type { PredictiveRegimeDay } from "@/lib/regime-features";

export type AnalysisJobRequestSnapshot = {
  jobType: "regime-discovery";
  source: "strategy-tracker";
  createdAt: string;
  runs: Array<{
    runId: string;
    name: string;
    bot: string;
    mode: string | null;
    instrument: string;
    yahooSymbol: string | null;
    timeframe: string;
    settings: unknown;
    tags: string;
    isGolden: boolean;
  }>;
  trades: Array<AnalysisTradeSnapshot>;
  dailyMetrics: Array<AnalysisDailyMetricSnapshot>;
  marketBars: Array<AnalysisMarketBarSnapshot>;
  predictiveDays: Array<AnalysisPredictiveDaySnapshot>;
};

export type AnalysisTradeSnapshot = {
  runId: string;
  tradeNumber: number;
  closeTimeUtc: string;
  tradingDate: string;
  netProfit: number;
  cumulativeNetProfit: number;
  mae: number | null;
  mfe: number | null;
  etd: number | null;
};

export type AnalysisDailyMetricSnapshot = DailyRunMetric & {
  runId: string;
};

export type AnalysisMarketBarSnapshot = MarketBar & {
  instrument: string;
};

export type AnalysisPredictiveDaySnapshot = PredictiveRegimeDay & {
  runId: string;
};

export type AnalysisJobResult = {
  source: "local-heuristic";
  status: "complete";
  summary: string;
  factors: Array<{
    name: string;
    condition: string;
    action: "favor" | "avoid";
    threshold: number | null;
    lift: number;
    supportDays: number;
    validationLift: number | null;
    validated: boolean;
  }>;
  artifacts: Array<{
    type: "markdown";
    title: string;
    content: string;
  }>;
};

export function buildRegimeDiscoverySnapshot(
  run: RunDetail,
  predictiveDays: PredictiveRegimeDay[],
  createdAt = new Date().toISOString(),
): AnalysisJobRequestSnapshot {
  return {
    createdAt,
    dailyMetrics: run.dailyMetrics.map((day) => ({
      ...day,
      runId: run.id,
    })),
    jobType: "regime-discovery",
    marketBars: run.marketBars.map((bar) => ({
      ...bar,
      instrument: run.instrumentSymbol,
    })),
    predictiveDays: predictiveDays.map((day) => ({
      ...day,
      runId: run.id,
    })),
    runs: [
      {
        bot: run.botName,
        instrument: run.instrumentSymbol,
        isGolden: run.isGolden,
        mode: run.botModeName,
        name: run.name,
        runId: run.id,
        settings: parseSettings(run.settingsJson),
        tags: run.tags,
        timeframe: run.timeframe,
        yahooSymbol: run.yahooSymbol,
      },
    ],
    source: "strategy-tracker",
    trades: run.trades.map((trade) => tradeSnapshot(run.id, trade)),
  };
}

export function buildLocalRegimeDiscoveryResult(
  runName: string,
  suggestions: ThresholdSuggestion[],
): AnalysisJobResult {
  const topSuggestions = suggestions.slice(0, 8);

  return {
    artifacts: [
      {
        content: buildMarkdownReport(runName, topSuggestions),
        title: "Regime discovery report",
        type: "markdown",
      },
    ],
    factors: topSuggestions.map((suggestion) => ({
      action: suggestion.action,
      condition: suggestion.condition,
      lift: suggestion.lift,
      name: suggestion.feature,
      supportDays: suggestion.selectedCount,
      threshold: suggestion.threshold,
      validated: suggestion.validated,
      validationLift: suggestion.validationLift,
    })),
    source: "local-heuristic",
    status: "complete",
    summary:
      topSuggestions.length === 0
        ? "No reliable predictive regime factors were found for this run yet."
        : `${topSuggestions.length} predictive regime factors were ranked for ${runName}.`,
  };
}

function tradeSnapshot(
  runId: string,
  trade: NormalizedTradeSummary,
): AnalysisTradeSnapshot {
  return {
    closeTimeUtc: trade.closeTimeUtc,
    cumulativeNetProfit: trade.cumulativeNetProfit,
    etd: trade.etd,
    mae: trade.mae,
    mfe: trade.mfe,
    netProfit: trade.netProfit,
    runId,
    tradeNumber: trade.tradeNumber,
    tradingDate: trade.tradingDate,
  };
}

function parseSettings(settingsJson: string) {
  try {
    return JSON.parse(settingsJson);
  } catch {
    return {};
  }
}

function buildMarkdownReport(
  runName: string,
  suggestions: ThresholdSuggestion[],
) {
  if (suggestions.length === 0) {
    return `# ${runName}\n\nNo predictive regime thresholds passed the current support filters.`;
  }

  const lines = suggestions.map(
    (suggestion, index) =>
      `${index + 1}. ${suggestion.condition}: ${suggestion.action} with ${suggestion.selectedCount} support days and ${suggestion.lift.toFixed(2)} average-PnL lift.`,
  );

  return [`# ${runName}`, "", ...lines].join("\n");
}
