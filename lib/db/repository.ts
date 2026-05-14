import type { DailyRunMetric, RunMetrics } from "@/lib/analytics";
import { client, ensureSchema } from "@/lib/db/client";
import type { NormalizedTradeSummary } from "@/lib/imports/ninjatrader";

export type RunSummary = {
  id: string;
  name: string;
  botName: string;
  botModeName: string | null;
  instrumentSymbol: string;
  yahooSymbol: string | null;
  timeframe: string;
  tags: string;
  tradeCount: number;
  netProfit: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number | null;
  expectancy: number;
  firstTradeAt: string | null;
  lastTradeAt: string | null;
  coverageStartDate: string | null;
  coverageEndDate: string | null;
  createdAt: string;
  isGolden: boolean;
};

export type RunDetail = RunSummary & {
  botId: string;
  instrumentId: string;
  settingsJson: string;
  notes: string;
  trades: NormalizedTradeSummary[];
  dailyMetrics: DailyRunMetric[];
  marketBars: MarketBar[];
  goldenRun: (RunSummary & { dailyMetrics: DailyRunMetric[] }) | null;
  importInfo: {
    fileName: string;
    fileHash: string;
    importProfile: string;
    rowCount: number;
    createdAt: string;
  } | null;
};

export type InstrumentOption = {
  id: string;
  symbol: string;
  name: string | null;
  yahooSymbol: string | null;
  exchangeTimezone: string;
  sessionStartHour: number;
};

export type BotOption = {
  id: string;
  name: string;
  modes: BotModeOption[];
};

export type BotModeOption = {
  id: string;
  botId: string;
  name: string;
  description: string;
};

export type ComboSourceRun = RunSummary & {
  dailyMetrics: DailyRunMetric[];
};

export type SavedCombo = {
  id: string;
  name: string;
  description: string;
  configJson: string;
  createdAt: string;
  updatedAt: string;
};

export type ComboVersion = {
  id: string;
  comboId: string;
  versionNumber: number;
  action: "created" | "updated" | "deleted" | "current";
  name: string;
  description: string;
  configJson: string;
  createdAt: string;
};

export type ComparisonRun = RunSummary & {
  dailyMetrics: DailyRunMetric[];
};

export type ComparisonGroup = {
  scope: string;
  runs: ComparisonRun[];
};

export type MarketRow = {
  instrumentId: string;
  symbol: string;
  yahooSymbol: string | null;
  tradingDate: string | null;
  close: number | null;
  atr14: number | null;
  sourceStatus: string | null;
  fetchedAt: string | null;
};

export type MarketBar = {
  tradingDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  trueRange: number | null;
  atr14: number | null;
  range: number | null;
  gap: number | null;
  sourceStatus: string;
};

export type AnalysisSettings = {
  emaFastPeriod: number;
  emaMidPeriod: number;
  emaSlowPeriod: number;
  rsiPeriod: number;
  updatedAt: string | null;
};

export type AnalysisJobStatus = "queued" | "running" | "complete" | "failed";

export type AnalysisJob = {
  id: string;
  jobType: string;
  status: AnalysisJobStatus;
  inputJson: string;
  resultJson: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type InsertImportedRunInput = {
  fileName: string;
  fileHash: string;
  rawCsv: string;
  importProfile: string;
  headers: string[];
  botId: string;
  botModeId: string;
  instrumentId: string;
  timeframe: string;
  runName: string;
  settingsJson: string;
  tags: string;
  notes: string;
  metrics: RunMetrics;
  dailyMetrics: DailyRunMetric[];
  trades: NormalizedTradeSummary[];
};

export const defaultAnalysisSettings: AnalysisSettings = {
  emaFastPeriod: 9,
  emaMidPeriod: 13,
  emaSlowPeriod: 21,
  rsiPeriod: 14,
  updatedAt: null,
};

export async function insertImportedRun(input: InsertImportedRunInput) {
  await ensureSchema();

  const now = new Date().toISOString();
  await assertBotModeBelongsToBot(input.botId, input.botModeId);
  await assertInstrumentExists(input.instrumentId);
  const runId = crypto.randomUUID();
  const importId = crypto.randomUUID();

  await client.execute({
    sql: `INSERT INTO runs (
      id, bot_id, instrument_id, name, timeframe, settings_json, tags, notes,
      bot_mode_id,
      trade_count, first_trade_at, last_trade_at, net_profit, max_drawdown,
      win_rate, profit_factor, expectancy, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      runId,
      input.botId,
      input.instrumentId,
      input.runName,
      input.timeframe,
      input.settingsJson,
      input.tags,
      input.notes,
      input.botModeId,
      input.metrics.tradeCount,
      input.metrics.firstTradeAt,
      input.metrics.lastTradeAt,
      input.metrics.netProfit,
      input.metrics.maxDrawdown,
      input.metrics.winRate,
      input.metrics.profitFactor,
      input.metrics.expectancy,
      now,
      now,
    ],
  });

  await client.execute({
    sql: `INSERT INTO imports (
      id, run_id, file_name, file_hash, raw_csv, import_profile, mapping_json,
      row_count, status, error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      importId,
      runId,
      input.fileName,
      input.fileHash,
      input.rawCsv,
      input.importProfile,
      JSON.stringify({ headers: input.headers }),
      input.trades.length,
      "imported",
      null,
      now,
    ],
  });

  for (const trade of input.trades) {
    await client.execute({
      sql: `INSERT INTO trade_summaries (
        id, run_id, trade_number, close_time_raw, close_time_utc, trading_date,
        cumulative_net_profit, net_profit, commission, cumulative_max_drawdown,
        max_drawdown, mae, mfe, etd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        runId,
        trade.tradeNumber,
        trade.closeTimeRaw,
        trade.closeTimeUtc,
        trade.tradingDate,
        trade.cumulativeNetProfit,
        trade.netProfit,
        trade.commission,
        trade.cumulativeMaxDrawdown,
        trade.maxDrawdown,
        trade.mae,
        trade.mfe,
        trade.etd,
      ],
    });
  }

  for (const day of input.dailyMetrics) {
    await client.execute({
      sql: `INSERT INTO daily_run_metrics (
        id, run_id, trading_date, trade_count, net_profit, cumulative_net_profit,
        win_count, loss_count, max_drawdown, best_trade, worst_trade, avg_mae,
        avg_mfe
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        runId,
        day.tradingDate,
        day.tradeCount,
        day.netProfit,
        day.cumulativeNetProfit,
        day.winCount,
        day.lossCount,
        day.maxDrawdown,
        day.bestTrade,
        day.worstTrade,
        day.avgMae,
        day.avgMfe,
      ],
    });
  }

  return runId;
}

export async function listRuns(): Promise<RunSummary[]> {
  await ensureSchema();

  const result = await client.execute(`
    SELECT
      runs.*,
      bots.name AS bot_name,
      bot_modes.name AS bot_mode_name,
      instruments.symbol AS instrument_symbol,
      instruments.yahoo_symbol AS yahoo_symbol,
      coverage.coverage_start_date,
      coverage.coverage_end_date,
      CASE WHEN golden_baselines.run_id = runs.id THEN 1 ELSE 0 END AS is_golden
    FROM runs
    JOIN bots ON bots.id = runs.bot_id
    LEFT JOIN bot_modes ON bot_modes.id = runs.bot_mode_id
    JOIN instruments ON instruments.id = runs.instrument_id
    LEFT JOIN golden_baselines
      ON golden_baselines.bot_id = runs.bot_id
      AND (
        golden_baselines.bot_mode_id = runs.bot_mode_id
        OR (golden_baselines.bot_mode_id IS NULL AND runs.bot_mode_id IS NULL)
      )
      AND golden_baselines.instrument_id = runs.instrument_id
      AND golden_baselines.timeframe = runs.timeframe
    LEFT JOIN (
      SELECT run_id,
        MIN(trading_date) AS coverage_start_date,
        MAX(trading_date) AS coverage_end_date
      FROM daily_run_metrics
      GROUP BY run_id
    ) coverage ON coverage.run_id = runs.id
    ORDER BY runs.created_at DESC
  `);

  return result.rows.map(mapRunSummary);
}

export async function getRunDetail(id: string): Promise<RunDetail | null> {
  await ensureSchema();

  const runResult = await client.execute({
    sql: `
      SELECT
        runs.*,
        bots.name AS bot_name,
        bot_modes.name AS bot_mode_name,
        instruments.symbol AS instrument_symbol,
        instruments.yahoo_symbol AS yahoo_symbol,
        coverage.coverage_start_date,
        coverage.coverage_end_date,
        CASE WHEN golden_baselines.run_id = runs.id THEN 1 ELSE 0 END AS is_golden
      FROM runs
      JOIN bots ON bots.id = runs.bot_id
      LEFT JOIN bot_modes ON bot_modes.id = runs.bot_mode_id
      JOIN instruments ON instruments.id = runs.instrument_id
      LEFT JOIN golden_baselines
        ON golden_baselines.bot_id = runs.bot_id
        AND (
          golden_baselines.bot_mode_id = runs.bot_mode_id
          OR (golden_baselines.bot_mode_id IS NULL AND runs.bot_mode_id IS NULL)
        )
        AND golden_baselines.instrument_id = runs.instrument_id
        AND golden_baselines.timeframe = runs.timeframe
      LEFT JOIN (
        SELECT run_id,
          MIN(trading_date) AS coverage_start_date,
          MAX(trading_date) AS coverage_end_date
        FROM daily_run_metrics
        GROUP BY run_id
      ) coverage ON coverage.run_id = runs.id
      WHERE runs.id = ?
      LIMIT 1
    `,
    args: [id],
  });
  const row = runResult.rows[0];

  if (!row) {
    return null;
  }

  const summary = mapRunSummary(row);
  const trades = await listTradesForRun(id);
  const dailyMetrics = await listDailyMetricsForRun(id);
  const marketBars = await listMarketBarsForInstrument(
    String(row.instrument_id),
  );
  const goldenRun = await getGoldenRunForScope(
    String(row.bot_id),
    stringOrNull(row.bot_mode_id),
    String(row.instrument_id),
    String(row.timeframe),
  );
  const importInfo = await getImportInfo(id);

  return {
    ...summary,
    botId: String(row.bot_id),
    instrumentId: String(row.instrument_id),
    settingsJson: String(row.settings_json),
    notes: String(row.notes),
    trades,
    dailyMetrics,
    marketBars,
    goldenRun,
    importInfo,
  };
}

export async function setGoldenRun(runId: string) {
  await ensureSchema();

  const runResult = await client.execute({
    sql: `SELECT bot_id, bot_mode_id, instrument_id, timeframe
      FROM runs
      WHERE id = ?
      LIMIT 1`,
    args: [runId],
  });
  const run = runResult.rows[0];

  if (!run) {
    throw new Error("Run not found.");
  }

  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO golden_baselines (
      id, bot_id, bot_mode_id, instrument_id, timeframe, run_id, created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(bot_id, bot_mode_id, instrument_id, timeframe)
    DO UPDATE SET run_id = excluded.run_id, updated_at = excluded.updated_at`,
    args: [
      crypto.randomUUID(),
      String(run.bot_id),
      stringOrNull(run.bot_mode_id),
      String(run.instrument_id),
      String(run.timeframe),
      runId,
      now,
      now,
    ],
  });
}

export async function createBot(input: { name: string }) {
  await ensureSchema();

  const name = input.name.trim();

  if (!name) {
    throw new Error("Bot name is required.");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await client.execute({
    sql: "INSERT INTO bots (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    args: [id, name, now, now],
  });

  return id;
}

export async function updateBot(input: { id: string; name: string }) {
  await ensureSchema();

  const id = input.id.trim();
  const name = input.name.trim();

  if (!id || !name) {
    throw new Error("Bot and name are required.");
  }

  const result = await client.execute({
    sql: `UPDATE bots
      SET name = ?, updated_at = ?
      WHERE id = ?`,
    args: [name, new Date().toISOString(), id],
  });

  if (result.rowsAffected === 0) {
    throw new Error("Bot not found.");
  }
}

export async function createBotMode(input: {
  botId: string;
  name: string;
  description: string;
}) {
  await ensureSchema();

  const name = input.name.trim();

  if (!input.botId || !name) {
    throw new Error("Bot and mode name are required.");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await client.execute({
    sql: `INSERT INTO bot_modes (
      id, bot_id, name, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, input.botId, name, input.description.trim(), now, now],
  });

  return id;
}

export async function updateBotMode(input: {
  id: string;
  name: string;
  description: string;
}) {
  await ensureSchema();

  const id = input.id.trim();
  const name = input.name.trim();

  if (!id || !name) {
    throw new Error("Mode and name are required.");
  }

  const result = await client.execute({
    sql: `UPDATE bot_modes
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?`,
    args: [name, input.description.trim(), new Date().toISOString(), id],
  });

  if (result.rowsAffected === 0) {
    throw new Error("Mode not found.");
  }
}

export async function createInstrument(input: {
  symbol: string;
  name: string;
  yahooSymbol: string;
  exchangeTimezone: string;
  sessionStartHour: number;
}) {
  await ensureSchema();

  const symbol = input.symbol.trim().toUpperCase();

  if (!symbol) {
    throw new Error("Instrument symbol is required.");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await client.execute({
    sql: `INSERT INTO instruments (
      id, symbol, name, yahoo_symbol, exchange_timezone, session_start_hour,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      symbol,
      input.name.trim() || symbol,
      input.yahooSymbol.trim() || null,
      input.exchangeTimezone.trim() || "America/New_York",
      input.sessionStartHour,
      now,
      now,
    ],
  });

  return id;
}

export async function updateInstrument(input: {
  id: string;
  symbol: string;
  name: string;
  yahooSymbol: string;
  exchangeTimezone: string;
  sessionStartHour: number;
}) {
  await ensureSchema();

  const id = input.id.trim();
  const symbol = input.symbol.trim().toUpperCase();

  if (!id || !symbol) {
    throw new Error("Instrument and symbol are required.");
  }

  if (
    !Number.isInteger(input.sessionStartHour) ||
    input.sessionStartHour < 0 ||
    input.sessionStartHour > 23
  ) {
    throw new Error("Session start hour must be between 0 and 23.");
  }

  const result = await client.execute({
    sql: `UPDATE instruments
      SET symbol = ?, name = ?, yahoo_symbol = ?, exchange_timezone = ?,
        session_start_hour = ?, updated_at = ?
      WHERE id = ?`,
    args: [
      symbol,
      input.name.trim() || symbol,
      input.yahooSymbol.trim() || null,
      input.exchangeTimezone.trim() || "America/New_York",
      input.sessionStartHour,
      new Date().toISOString(),
      id,
    ],
  });

  if (result.rowsAffected === 0) {
    throw new Error("Instrument not found.");
  }
}

export async function listBotsWithModes(): Promise<BotOption[]> {
  await ensureSchema();

  const botsResult = await client.execute(`
    SELECT id, name
    FROM bots
    ORDER BY name ASC
  `);
  const modesResult = await client.execute(`
    SELECT id, bot_id, name, description
    FROM bot_modes
    ORDER BY name ASC
  `);
  const modesByBot = new Map<string, BotModeOption[]>();

  for (const row of modesResult.rows) {
    const botId = String(row.bot_id);
    const modes = modesByBot.get(botId) ?? [];
    modes.push({
      id: String(row.id),
      botId,
      name: String(row.name),
      description: String(row.description),
    });
    modesByBot.set(botId, modes);
  }

  return botsResult.rows.map((row) => {
    const id = String(row.id);
    return {
      id,
      name: String(row.name),
      modes: modesByBot.get(id) ?? [],
    };
  });
}

export async function listComboSourceRuns(): Promise<ComboSourceRun[]> {
  const runs = await listRuns();
  const sourceRuns: ComboSourceRun[] = [];

  for (const run of runs) {
    sourceRuns.push({
      ...run,
      dailyMetrics: await listDailyMetricsForRun(run.id),
    });
  }

  return sourceRuns;
}

export async function listComparisonGroups(): Promise<ComparisonGroup[]> {
  const runs = await listRuns();
  const runDetails: ComparisonRun[] = [];

  for (const run of runs) {
    runDetails.push({
      ...run,
      dailyMetrics: await listDailyMetricsForRun(run.id),
    });
  }

  const groups = runDetails.reduce((map, run) => {
    const scope = `${run.botName} / ${run.botModeName ?? "No mode"} / ${run.instrumentSymbol} / ${run.timeframe}`;
    const scopedRuns = map.get(scope) ?? [];
    scopedRuns.push(run);
    map.set(scope, scopedRuns);
    return map;
  }, new Map<string, ComparisonRun[]>());

  return [...groups.entries()].map(([scope, scopedRuns]) => ({
    scope,
    runs: scopedRuns,
  }));
}

export async function saveCombo(input: {
  name: string;
  description: string;
  configJson: string;
}) {
  await ensureSchema();

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await client.execute({
    sql: `INSERT INTO combos (
      id, name, description, config_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, input.name, input.description, input.configJson, now, now],
  });
  await insertComboVersion({
    action: "created",
    comboId: id,
    configJson: input.configJson,
    createdAt: now,
    description: input.description,
    name: input.name,
  });
}

export async function updateSavedCombo(input: {
  id: string;
  name: string;
  description: string;
  configJson: string;
}) {
  await ensureSchema();

  if (!(await getSavedCombo(input.id))) {
    throw new Error("Combo not found.");
  }

  const now = new Date().toISOString();

  await client.execute({
    sql: `UPDATE combos
      SET name = ?, description = ?, config_json = ?, updated_at = ?
      WHERE id = ?`,
    args: [input.name, input.description, input.configJson, now, input.id],
  });
  await insertComboVersion({
    action: "updated",
    comboId: input.id,
    configJson: input.configJson,
    createdAt: now,
    description: input.description,
    name: input.name,
  });
}

export async function deleteSavedCombo(id: string) {
  await ensureSchema();

  const existing = await getSavedCombo(id);

  if (!existing) {
    throw new Error("Combo not found.");
  }

  await insertComboVersion({
    action: "deleted",
    comboId: id,
    configJson: existing.configJson,
    createdAt: new Date().toISOString(),
    description: existing.description,
    name: existing.name,
  });
  await client.execute({
    sql: `DELETE FROM combos WHERE id = ?`,
    args: [id],
  });
}

export async function listSavedCombos(): Promise<SavedCombo[]> {
  await ensureSchema();

  const result = await client.execute(`
    SELECT id, name, description, config_json, created_at, updated_at
    FROM combos
    ORDER BY updated_at DESC
  `);

  return result.rows.map(savedComboFromRow);
}

export async function getSavedCombo(id: string): Promise<SavedCombo | null> {
  await ensureSchema();

  const result = await client.execute({
    sql: `
      SELECT id, name, description, config_json, created_at, updated_at
      FROM combos
      WHERE id = ?
    `,
    args: [id],
  });
  const row = result.rows[0];

  return row ? savedComboFromRow(row) : null;
}

export async function listComboVersions(
  combo: SavedCombo,
): Promise<ComboVersion[]> {
  await ensureSchema();

  const result = await client.execute({
    sql: `SELECT id, combo_id, version_number, action, name, description,
        config_json, created_at
      FROM combo_versions
      WHERE combo_id = ?
      ORDER BY version_number DESC`,
    args: [combo.id],
  });
  const versions = result.rows.map(comboVersionFromRow);

  if (versions.length > 0) {
    return versions;
  }

  return [
    {
      action: "current",
      comboId: combo.id,
      configJson: combo.configJson,
      createdAt: combo.createdAt,
      description: combo.description,
      id: combo.id,
      name: combo.name,
      versionNumber: 1,
    },
  ];
}

export async function listInstruments(): Promise<InstrumentOption[]> {
  await ensureSchema();

  const result = await client.execute(`
    SELECT id, symbol, name, yahoo_symbol, exchange_timezone, session_start_hour
    FROM instruments
    ORDER BY symbol ASC
  `);

  return result.rows.map((row) => ({
    id: String(row.id),
    symbol: String(row.symbol),
    name: stringOrNull(row.name),
    yahooSymbol: stringOrNull(row.yahoo_symbol),
    exchangeTimezone: String(row.exchange_timezone),
    sessionStartHour: Number(row.session_start_hour),
  }));
}

export async function getInstrument(
  id: string,
): Promise<InstrumentOption | null> {
  await ensureSchema();

  const result = await client.execute({
    sql: `SELECT id, symbol, name, yahoo_symbol, exchange_timezone, session_start_hour
      FROM instruments
      WHERE id = ?
      LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    symbol: String(row.symbol),
    name: stringOrNull(row.name),
    yahooSymbol: stringOrNull(row.yahoo_symbol),
    exchangeTimezone: String(row.exchange_timezone),
    sessionStartHour: Number(row.session_start_hour),
  };
}

export async function getAnalysisSettings(): Promise<AnalysisSettings> {
  await ensureSchema();

  const result = await client.execute({
    sql: `SELECT ema_fast_period, ema_mid_period, ema_slow_period,
        rsi_period, updated_at
      FROM analysis_settings
      WHERE id = 'global'
      LIMIT 1`,
    args: [],
  });
  const row = result.rows[0];

  if (!row) {
    return defaultAnalysisSettings;
  }

  return {
    emaFastPeriod: Number(row.ema_fast_period),
    emaMidPeriod: Number(row.ema_mid_period),
    emaSlowPeriod: Number(row.ema_slow_period),
    rsiPeriod: Number(row.rsi_period),
    updatedAt: String(row.updated_at),
  };
}

export async function updateAnalysisSettings(input: {
  emaFastPeriod: number;
  emaMidPeriod: number;
  emaSlowPeriod: number;
  rsiPeriod: number;
}) {
  await ensureSchema();
  assertAnalysisSettings(input);

  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO analysis_settings (
      id, ema_fast_period, ema_mid_period, ema_slow_period, rsi_period,
      updated_at
    ) VALUES ('global', ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      ema_fast_period = excluded.ema_fast_period,
      ema_mid_period = excluded.ema_mid_period,
      ema_slow_period = excluded.ema_slow_period,
      rsi_period = excluded.rsi_period,
      updated_at = excluded.updated_at`,
    args: [
      input.emaFastPeriod,
      input.emaMidPeriod,
      input.emaSlowPeriod,
      input.rsiPeriod,
      now,
    ],
  });
}

export async function createAnalysisJob(input: {
  jobType: string;
  inputJson: string;
  resultJson?: string | null;
  status?: AnalysisJobStatus;
  error?: string | null;
}) {
  await ensureSchema();

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const status = input.status ?? "queued";
  const completedAt = status === "complete" || status === "failed" ? now : null;

  await client.execute({
    sql: `INSERT INTO analysis_jobs (
      id, job_type, status, input_json, result_json, error, created_at,
      updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.jobType,
      status,
      input.inputJson,
      input.resultJson ?? null,
      input.error ?? null,
      now,
      now,
      completedAt,
    ],
  });

  const job = await getAnalysisJob(id);

  if (!job) {
    throw new Error("Analysis job could not be created.");
  }

  return job;
}

export async function listAnalysisJobs(): Promise<AnalysisJob[]> {
  await ensureSchema();

  const result = await client.execute(`
    SELECT id, job_type, status, input_json, result_json, error, created_at,
      updated_at, completed_at
    FROM analysis_jobs
    ORDER BY created_at DESC
  `);

  return result.rows.map(analysisJobFromRow);
}

export async function getAnalysisJob(id: string): Promise<AnalysisJob | null> {
  await ensureSchema();

  const result = await client.execute({
    sql: `SELECT id, job_type, status, input_json, result_json, error,
        created_at, updated_at, completed_at
      FROM analysis_jobs
      WHERE id = ?
      LIMIT 1`,
    args: [id],
  });
  const row = result.rows[0];

  return row ? analysisJobFromRow(row) : null;
}

export async function listMarketRows(): Promise<MarketRow[]> {
  await ensureSchema();

  const result = await client.execute(`
    SELECT
      instruments.id AS instrument_id,
      instruments.symbol,
      instruments.yahoo_symbol,
      latest.trading_date,
      latest.close,
      latest.atr14,
      latest.source_status,
      latest.fetched_at
    FROM instruments
    LEFT JOIN market_bars latest
      ON latest.instrument_id = instruments.id
      AND latest.trading_date = (
        SELECT MAX(trading_date)
        FROM market_bars
        WHERE market_bars.instrument_id = instruments.id
      )
    ORDER BY instruments.symbol ASC
  `);

  return result.rows.map((row) => ({
    instrumentId: String(row.instrument_id),
    symbol: String(row.symbol),
    yahooSymbol: stringOrNull(row.yahoo_symbol),
    tradingDate: stringOrNull(row.trading_date),
    close: numberOrNull(row.close),
    atr14: numberOrNull(row.atr14),
    sourceStatus: stringOrNull(row.source_status),
    fetchedAt: stringOrNull(row.fetched_at),
  }));
}

export async function listMarketBarsForInstrument(
  instrumentId: string,
): Promise<MarketBar[]> {
  await ensureSchema();

  const result = await client.execute({
    sql: `SELECT trading_date, open, high, low, close, volume, true_range,
        atr14, range, gap, source_status
      FROM market_bars
      WHERE instrument_id = ?
      ORDER BY trading_date ASC`,
    args: [instrumentId],
  });

  return result.rows.map((row) => ({
    tradingDate: String(row.trading_date),
    open: numberOrNull(row.open),
    high: numberOrNull(row.high),
    low: numberOrNull(row.low),
    close: numberOrNull(row.close),
    volume: numberOrNull(row.volume),
    trueRange: numberOrNull(row.true_range),
    atr14: numberOrNull(row.atr14),
    range: numberOrNull(row.range),
    gap: numberOrNull(row.gap),
    sourceStatus: String(row.source_status),
  }));
}

export async function upsertMarketBar(input: {
  instrumentId: string;
  yahooSymbol: string;
  tradingDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  trueRange: number | null;
  atr14: number | null;
  range: number | null;
  gap: number | null;
  sourceStatus: string;
  sourceMessage: string | null;
}) {
  await ensureSchema();

  await client.execute({
    sql: `INSERT INTO market_bars (
      id, instrument_id, yahoo_symbol, trading_date, open, high, low, close,
      volume, true_range, atr14, range, gap, source_status, source_message,
      fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(instrument_id, trading_date)
    DO UPDATE SET
      yahoo_symbol = excluded.yahoo_symbol,
      open = excluded.open,
      high = excluded.high,
      low = excluded.low,
      close = excluded.close,
      volume = excluded.volume,
      true_range = excluded.true_range,
      atr14 = excluded.atr14,
      range = excluded.range,
      gap = excluded.gap,
      source_status = excluded.source_status,
      source_message = excluded.source_message,
      fetched_at = excluded.fetched_at`,
    args: [
      crypto.randomUUID(),
      input.instrumentId,
      input.yahooSymbol,
      input.tradingDate,
      input.open,
      input.high,
      input.low,
      input.close,
      input.volume,
      input.trueRange,
      input.atr14,
      input.range,
      input.gap,
      input.sourceStatus,
      input.sourceMessage,
      new Date().toISOString(),
    ],
  });
}

async function assertBotModeBelongsToBot(botId: string, botModeId: string) {
  const result = await client.execute({
    sql: `SELECT id
      FROM bot_modes
      WHERE id = ? AND bot_id = ?
      LIMIT 1`,
    args: [botModeId, botId],
  });

  if (!result.rows[0]) {
    throw new Error("Choose a valid mode for the selected bot.");
  }
}

async function assertInstrumentExists(instrumentId: string) {
  const result = await client.execute({
    sql: "SELECT id FROM instruments WHERE id = ? LIMIT 1",
    args: [instrumentId],
  });

  if (!result.rows[0]) {
    throw new Error("Choose a valid instrument.");
  }
}

function assertAnalysisSettings(input: {
  emaFastPeriod: number;
  emaMidPeriod: number;
  emaSlowPeriod: number;
  rsiPeriod: number;
}) {
  const values = [
    input.emaFastPeriod,
    input.emaMidPeriod,
    input.emaSlowPeriod,
    input.rsiPeriod,
  ];

  if (values.some((value) => !Number.isInteger(value) || value < 1)) {
    throw new Error("Indicator periods must be positive integers.");
  }

  if (
    !(
      input.emaFastPeriod < input.emaMidPeriod &&
      input.emaMidPeriod < input.emaSlowPeriod
    )
  ) {
    throw new Error("EMA periods must be ordered fast < mid < slow.");
  }
}

async function getGoldenRunForScope(
  botId: string,
  botModeId: string | null,
  instrumentId: string,
  timeframe: string,
): Promise<(RunSummary & { dailyMetrics: DailyRunMetric[] }) | null> {
  const result = await client.execute({
    sql: `
      SELECT runs.*, bots.name AS bot_name, bot_modes.name AS bot_mode_name,
        instruments.symbol AS instrument_symbol, instruments.yahoo_symbol AS yahoo_symbol,
        coverage.coverage_start_date, coverage.coverage_end_date,
        1 AS is_golden
      FROM golden_baselines
      JOIN runs ON runs.id = golden_baselines.run_id
      JOIN bots ON bots.id = runs.bot_id
      LEFT JOIN bot_modes ON bot_modes.id = runs.bot_mode_id
      JOIN instruments ON instruments.id = runs.instrument_id
      LEFT JOIN (
        SELECT run_id,
          MIN(trading_date) AS coverage_start_date,
          MAX(trading_date) AS coverage_end_date
        FROM daily_run_metrics
        GROUP BY run_id
      ) coverage ON coverage.run_id = runs.id
      WHERE golden_baselines.bot_id = ?
        AND (
          golden_baselines.bot_mode_id = ?
          OR (golden_baselines.bot_mode_id IS NULL AND ? IS NULL)
        )
        AND golden_baselines.instrument_id = ?
        AND golden_baselines.timeframe = ?
      LIMIT 1
    `,
    args: [botId, botModeId, botModeId, instrumentId, timeframe],
  });
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const summary = mapRunSummary(row);
  return {
    ...summary,
    dailyMetrics: await listDailyMetricsForRun(summary.id),
  };
}

async function getImportInfo(runId: string) {
  const result = await client.execute({
    sql: `SELECT file_name, file_hash, import_profile, row_count, created_at
      FROM imports
      WHERE run_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
    args: [runId],
  });
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    fileName: String(row.file_name),
    fileHash: String(row.file_hash),
    importProfile: String(row.import_profile),
    rowCount: Number(row.row_count),
    createdAt: String(row.created_at),
  };
}

async function listTradesForRun(
  runId: string,
): Promise<NormalizedTradeSummary[]> {
  const result = await client.execute({
    sql: `SELECT *
      FROM trade_summaries
      WHERE run_id = ?
      ORDER BY trade_number ASC`,
    args: [runId],
  });

  return result.rows.map((row) => ({
    tradeNumber: Number(row.trade_number),
    closeTimeRaw: String(row.close_time_raw),
    closeTimeUtc: String(row.close_time_utc),
    tradingDate: String(row.trading_date),
    cumulativeNetProfit: Number(row.cumulative_net_profit),
    netProfit: Number(row.net_profit),
    commission: Number(row.commission),
    cumulativeMaxDrawdown: Number(row.cumulative_max_drawdown),
    maxDrawdown: Number(row.max_drawdown),
    mae: numberOrNull(row.mae),
    mfe: numberOrNull(row.mfe),
    etd: numberOrNull(row.etd),
  }));
}

async function listDailyMetricsForRun(
  runId: string,
): Promise<DailyRunMetric[]> {
  const result = await client.execute({
    sql: `SELECT *
      FROM daily_run_metrics
      WHERE run_id = ?
      ORDER BY trading_date ASC`,
    args: [runId],
  });

  return result.rows.map((row) => ({
    tradingDate: String(row.trading_date),
    tradeCount: Number(row.trade_count),
    netProfit: Number(row.net_profit),
    cumulativeNetProfit: Number(row.cumulative_net_profit),
    winCount: Number(row.win_count),
    lossCount: Number(row.loss_count),
    maxDrawdown: Number(row.max_drawdown),
    bestTrade: Number(row.best_trade),
    worstTrade: Number(row.worst_trade),
    avgMae: numberOrNull(row.avg_mae),
    avgMfe: numberOrNull(row.avg_mfe),
  }));
}

function mapRunSummary(row: Record<string, unknown>): RunSummary {
  return {
    id: String(row.id),
    name: String(row.name),
    botName: String(row.bot_name),
    botModeName: stringOrNull(row.bot_mode_name),
    instrumentSymbol: String(row.instrument_symbol),
    yahooSymbol: stringOrNull(row.yahoo_symbol),
    timeframe: String(row.timeframe),
    tags: String(row.tags),
    tradeCount: Number(row.trade_count),
    netProfit: Number(row.net_profit),
    maxDrawdown: Number(row.max_drawdown),
    winRate: Number(row.win_rate),
    profitFactor: numberOrNull(row.profit_factor),
    expectancy: Number(row.expectancy),
    firstTradeAt: stringOrNull(row.first_trade_at),
    lastTradeAt: stringOrNull(row.last_trade_at),
    coverageStartDate: stringOrNull(row.coverage_start_date),
    coverageEndDate: stringOrNull(row.coverage_end_date),
    createdAt: String(row.created_at),
    isGolden: Number(row.is_golden) === 1,
  };
}

function savedComboFromRow(row: Record<string, unknown>): SavedCombo {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    configJson: String(row.config_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function comboVersionFromRow(row: Record<string, unknown>): ComboVersion {
  return {
    id: String(row.id),
    comboId: String(row.combo_id),
    versionNumber: Number(row.version_number),
    action: comboVersionAction(row.action),
    name: String(row.name),
    description: String(row.description),
    configJson: String(row.config_json),
    createdAt: String(row.created_at),
  };
}

function analysisJobFromRow(row: Record<string, unknown>): AnalysisJob {
  return {
    id: String(row.id),
    jobType: String(row.job_type),
    status: analysisJobStatus(row.status),
    inputJson: String(row.input_json),
    resultJson: stringOrNull(row.result_json),
    error: stringOrNull(row.error),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: stringOrNull(row.completed_at),
  };
}

function analysisJobStatus(value: unknown): AnalysisJobStatus {
  if (
    value === "queued" ||
    value === "running" ||
    value === "complete" ||
    value === "failed"
  ) {
    return value;
  }

  return "failed";
}

async function insertComboVersion(input: {
  comboId: string;
  action: ComboVersion["action"];
  name: string;
  description: string;
  configJson: string;
  createdAt: string;
}) {
  const versionResult = await client.execute({
    sql: `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
      FROM combo_versions
      WHERE combo_id = ?`,
    args: [input.comboId],
  });
  const versionNumber = Number(versionResult.rows[0]?.next_version ?? 1);

  await client.execute({
    sql: `INSERT INTO combo_versions (
      id, combo_id, version_number, action, name, description, config_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      input.comboId,
      versionNumber,
      input.action,
      input.name,
      input.description,
      input.configJson,
      input.createdAt,
    ],
  });
}

function comboVersionAction(value: unknown): ComboVersion["action"] {
  if (
    value === "created" ||
    value === "updated" ||
    value === "deleted" ||
    value === "current"
  ) {
    return value;
  }

  return "updated";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}
