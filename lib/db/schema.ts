import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const bots = sqliteTable("bots", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const botModes = sqliteTable(
  "bot_modes",
  {
    id: text("id").primaryKey(),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id),
    name: text("name").notNull(),
    description: text("description").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    botModeNameIndex: uniqueIndex("bot_modes_bot_name_idx").on(
      table.botId,
      table.name,
    ),
  }),
);

export const instruments = sqliteTable("instruments", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name"),
  yahooSymbol: text("yahoo_symbol"),
  exchangeTimezone: text("exchange_timezone").notNull(),
  sessionStartHour: integer("session_start_hour").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id),
    botModeId: text("bot_mode_id").references(() => botModes.id),
    instrumentId: text("instrument_id")
      .notNull()
      .references(() => instruments.id),
    name: text("name").notNull(),
    timeframe: text("timeframe").notNull(),
    settingsJson: text("settings_json").notNull(),
    tags: text("tags").notNull(),
    notes: text("notes").notNull(),
    tradeCount: integer("trade_count").notNull(),
    firstTradeAt: text("first_trade_at"),
    lastTradeAt: text("last_trade_at"),
    netProfit: real("net_profit").notNull(),
    maxDrawdown: real("max_drawdown").notNull(),
    winRate: real("win_rate").notNull(),
    profitFactor: real("profit_factor"),
    expectancy: real("expectancy").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    botInstrumentIndex: index("runs_bot_instrument_idx").on(
      table.botId,
      table.instrumentId,
    ),
  }),
);

export const imports = sqliteTable("imports", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  fileName: text("file_name").notNull(),
  fileHash: text("file_hash").notNull(),
  rawCsv: text("raw_csv").notNull(),
  importProfile: text("import_profile").notNull(),
  mappingJson: text("mapping_json").notNull(),
  rowCount: integer("row_count").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: text("created_at").notNull(),
});

export const tradeSummaries = sqliteTable(
  "trade_summaries",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    tradeNumber: integer("trade_number").notNull(),
    closeTimeRaw: text("close_time_raw").notNull(),
    closeTimeUtc: text("close_time_utc").notNull(),
    tradingDate: text("trading_date").notNull(),
    cumulativeNetProfit: real("cumulative_net_profit").notNull(),
    netProfit: real("net_profit").notNull(),
    commission: real("commission").notNull(),
    cumulativeMaxDrawdown: real("cumulative_max_drawdown").notNull(),
    maxDrawdown: real("max_drawdown").notNull(),
    mae: real("mae"),
    mfe: real("mfe"),
    etd: real("etd"),
  },
  (table) => ({
    runTradeNumberIndex: uniqueIndex("trade_summaries_run_number_idx").on(
      table.runId,
      table.tradeNumber,
    ),
    runDateIndex: index("trade_summaries_run_date_idx").on(
      table.runId,
      table.tradingDate,
    ),
  }),
);

export const dailyRunMetrics = sqliteTable(
  "daily_run_metrics",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    tradingDate: text("trading_date").notNull(),
    tradeCount: integer("trade_count").notNull(),
    netProfit: real("net_profit").notNull(),
    cumulativeNetProfit: real("cumulative_net_profit").notNull(),
    winCount: integer("win_count").notNull(),
    lossCount: integer("loss_count").notNull(),
    maxDrawdown: real("max_drawdown").notNull(),
    bestTrade: real("best_trade").notNull(),
    worstTrade: real("worst_trade").notNull(),
    avgMae: real("avg_mae"),
    avgMfe: real("avg_mfe"),
  },
  (table) => ({
    runDateIndex: uniqueIndex("daily_run_metrics_run_date_idx").on(
      table.runId,
      table.tradingDate,
    ),
  }),
);

export const goldenBaselines = sqliteTable(
  "golden_baselines",
  {
    id: text("id").primaryKey(),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id),
    botModeId: text("bot_mode_id").references(() => botModes.id),
    instrumentId: text("instrument_id")
      .notNull()
      .references(() => instruments.id),
    timeframe: text("timeframe").notNull(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    scopeIndex: uniqueIndex("golden_baselines_scope_mode_idx").on(
      table.botId,
      table.botModeId,
      table.instrumentId,
      table.timeframe,
    ),
  }),
);

export const marketBars = sqliteTable(
  "market_bars",
  {
    id: text("id").primaryKey(),
    instrumentId: text("instrument_id")
      .notNull()
      .references(() => instruments.id),
    yahooSymbol: text("yahoo_symbol").notNull(),
    tradingDate: text("trading_date").notNull(),
    open: real("open"),
    high: real("high"),
    low: real("low"),
    close: real("close"),
    volume: real("volume"),
    trueRange: real("true_range"),
    atr14: real("atr14"),
    range: real("range"),
    gap: real("gap"),
    sourceStatus: text("source_status").notNull(),
    sourceMessage: text("source_message"),
    fetchedAt: text("fetched_at").notNull(),
  },
  (table) => ({
    instrumentDateIndex: uniqueIndex("market_bars_instrument_date_idx").on(
      table.instrumentId,
      table.tradingDate,
    ),
  }),
);

export const combos = sqliteTable("combos", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  configJson: text("config_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const comboVersions = sqliteTable(
  "combo_versions",
  {
    id: text("id").primaryKey(),
    comboId: text("combo_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    action: text("action").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    configJson: text("config_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    comboIndex: index("combo_versions_combo_idx").on(
      table.comboId,
      table.versionNumber,
    ),
  }),
);

export const analysisSettings = sqliteTable("analysis_settings", {
  id: text("id").primaryKey(),
  emaFastPeriod: integer("ema_fast_period").notNull(),
  emaMidPeriod: integer("ema_mid_period").notNull(),
  emaSlowPeriod: integer("ema_slow_period").notNull(),
  rsiPeriod: integer("rsi_period").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const analysisJobs = sqliteTable(
  "analysis_jobs",
  {
    id: text("id").primaryKey(),
    jobType: text("job_type").notNull(),
    status: text("status").notNull(),
    inputJson: text("input_json").notNull(),
    resultJson: text("result_json"),
    error: text("error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => ({
    statusIndex: index("analysis_jobs_status_idx").on(
      table.status,
      table.createdAt,
    ),
  }),
);
