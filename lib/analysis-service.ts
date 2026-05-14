import "server-only";

import {
  buildLocalRegimeDiscoveryResult,
  buildRegimeDiscoverySnapshot,
} from "@/lib/analysis-contract";
import {
  createAnalysisJob,
  getAnalysisSettings,
  getRunDetail,
} from "@/lib/db/repository";
import { discoverRegimeThresholds } from "@/lib/regime-discovery";
import { buildPredictiveRegimeDays } from "@/lib/regime-features";

export async function createRegimeDiscoveryAnalysisJob(runId: string) {
  const [run, analysisSettings] = await Promise.all([
    getRunDetail(runId),
    getAnalysisSettings(),
  ]);

  if (!run) {
    throw new Error("Run not found.");
  }

  const predictiveDays = buildPredictiveRegimeDays(
    run.dailyMetrics,
    run.marketBars,
    analysisSettings,
  );
  const suggestions = discoverRegimeThresholds(predictiveDays, {
    atrPeriod: analysisSettings.atrPeriod,
    emaCrossLookbackDays: analysisSettings.emaCrossLookbackDays,
  });
  const snapshot = buildRegimeDiscoverySnapshot(run, predictiveDays);
  const result = buildLocalRegimeDiscoveryResult(run.name, suggestions);

  return createAnalysisJob({
    inputJson: JSON.stringify(snapshot),
    jobType: "regime-discovery",
    resultJson: JSON.stringify(result),
    status: "complete",
  });
}
