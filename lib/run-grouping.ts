export type RunScopeInput = {
  botName: string;
  botModeName: string | null;
  instrumentSymbol: string;
  timeframe: string;
};

export function comparisonScopeForRun(run: RunScopeInput) {
  return `${run.botName} / ${run.botModeName ?? "No mode"} / ${run.instrumentSymbol} / ${run.timeframe}`;
}

export function routingScopeForRun(run: RunScopeInput) {
  return `${run.botName} / ${run.instrumentSymbol} / ${run.timeframe}`;
}
