import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import "server-only";

import * as schema from "@/lib/db/schema";

const databaseUrl =
  process.env.TURSO_DATABASE_URL?.trim() || "file:strategy-tracker.local.db";
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

export const client = createClient({
  url: databaseUrl,
  authToken,
});

export const db = drizzle(client, { schema });

let schemaReady: Promise<void> | null = null;

export function ensureSchema() {
  schemaReady ??= initializeSchema();
  return schemaReady;
}

async function initializeSchema() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bot_modes (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL REFERENCES bots(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS bot_modes_bot_name_idx
      ON bot_modes(bot_id, name);

    CREATE TABLE IF NOT EXISTS instruments (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT,
      yahoo_symbol TEXT,
      exchange_timezone TEXT NOT NULL,
      session_start_hour INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL REFERENCES bots(id),
      bot_mode_id TEXT REFERENCES bot_modes(id),
      instrument_id TEXT NOT NULL REFERENCES instruments(id),
      name TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      tags TEXT NOT NULL,
      notes TEXT NOT NULL,
      trade_count INTEGER NOT NULL,
      first_trade_at TEXT,
      last_trade_at TEXT,
      net_profit REAL NOT NULL,
      max_drawdown REAL NOT NULL,
      win_rate REAL NOT NULL,
      profit_factor REAL,
      expectancy REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS runs_bot_instrument_idx
      ON runs(bot_id, instrument_id);

    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      file_name TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      raw_csv TEXT NOT NULL,
      import_profile TEXT NOT NULL,
      mapping_json TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trade_summaries (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      trade_number INTEGER NOT NULL,
      close_time_raw TEXT NOT NULL,
      close_time_utc TEXT NOT NULL,
      trading_date TEXT NOT NULL,
      cumulative_net_profit REAL NOT NULL,
      net_profit REAL NOT NULL,
      commission REAL NOT NULL,
      cumulative_max_drawdown REAL NOT NULL,
      max_drawdown REAL NOT NULL,
      mae REAL,
      mfe REAL,
      etd REAL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS trade_summaries_run_number_idx
      ON trade_summaries(run_id, trade_number);

    CREATE INDEX IF NOT EXISTS trade_summaries_run_date_idx
      ON trade_summaries(run_id, trading_date);

    CREATE TABLE IF NOT EXISTS daily_run_metrics (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      trading_date TEXT NOT NULL,
      trade_count INTEGER NOT NULL,
      net_profit REAL NOT NULL,
      cumulative_net_profit REAL NOT NULL,
      win_count INTEGER NOT NULL,
      loss_count INTEGER NOT NULL,
      max_drawdown REAL NOT NULL,
      best_trade REAL NOT NULL,
      worst_trade REAL NOT NULL,
      avg_mae REAL,
      avg_mfe REAL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS daily_run_metrics_run_date_idx
      ON daily_run_metrics(run_id, trading_date);

    CREATE TABLE IF NOT EXISTS golden_baselines (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL REFERENCES bots(id),
      bot_mode_id TEXT REFERENCES bot_modes(id),
      instrument_id TEXT NOT NULL REFERENCES instruments(id),
      timeframe TEXT NOT NULL,
      run_id TEXT NOT NULL REFERENCES runs(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    DROP INDEX IF EXISTS golden_baselines_scope_idx;

    CREATE TABLE IF NOT EXISTS market_bars (
      id TEXT PRIMARY KEY,
      instrument_id TEXT NOT NULL REFERENCES instruments(id),
      yahoo_symbol TEXT NOT NULL,
      trading_date TEXT NOT NULL,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume REAL,
      true_range REAL,
      atr14 REAL,
      range REAL,
      gap REAL,
      source_status TEXT NOT NULL,
      source_message TEXT,
      fetched_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS market_bars_instrument_date_idx
      ON market_bars(instrument_id, trading_date);

    CREATE TABLE IF NOT EXISTS combos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS combo_versions (
      id TEXT PRIMARY KEY,
      combo_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      action TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS combo_versions_combo_idx
      ON combo_versions(combo_id, version_number DESC);
  `);

  await addColumnIfMissing(
    "runs",
    "bot_mode_id",
    "TEXT REFERENCES bot_modes(id)",
  );
  await addColumnIfMissing(
    "golden_baselines",
    "bot_mode_id",
    "TEXT REFERENCES bot_modes(id)",
  );
  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS golden_baselines_scope_mode_idx
      ON golden_baselines(bot_id, bot_mode_id, instrument_id, timeframe)
  `);
}

async function addColumnIfMissing(
  tableName: string,
  columnName: string,
  definition: string,
) {
  const result = await client.execute(`PRAGMA table_info(${tableName})`);
  const exists = result.rows.some((row) => String(row.name) === columnName);

  if (!exists) {
    await client.execute(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
    );
  }
}
