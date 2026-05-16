import assert from "node:assert/strict";

import { comparisonScopeForRun, routingScopeForRun } from "@/lib/run-grouping";

const standardRun = {
  botName: "Tempest",
  botModeName: "Standard",
  instrumentSymbol: "NQ",
  timeframe: "1 min",
};
const aggressiveRun = {
  ...standardRun,
  botModeName: "Aggressive",
};

assert.notEqual(
  comparisonScopeForRun(standardRun),
  comparisonScopeForRun(aggressiveRun),
  "compare scopes include bot mode",
);

assert.equal(
  routingScopeForRun(standardRun),
  routingScopeForRun(aggressiveRun),
  "routing scopes group modes under the same bot/instrument/timeframe",
);
