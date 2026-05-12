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

export async function saveCombo(input: {
  name: string;
  description: string;
  configJson: string;
}) {
  await ensureSchema();

  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO combos (
      id, name, description, config_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      input.name,
      input.description,
      input.configJson,
      now,
      now,
    ],
  });
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
        1 AS is_golden
      FROM golden_baselines
      JOIN runs ON runs.id = golden_baselines.run_id
      JOIN bots ON bots.id = runs.bot_id
      LEFT JOIN bot_modes ON bot_modes.id = runs.bot_mode_id
      JOIN instruments ON instruments.id = runs.instrument_id
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
    createdAt: String(row.created_at),
    isGolden: Number(row.is_golden) === 1,
  };
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
