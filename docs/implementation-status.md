# Strategy Tracker Implementation Status

Last updated: 2026-05-12

## Implemented

- Next.js 16 App Router application shell with protected routes.
- Auth.js credentials login using `STRATEGY_TRACKER_PASSWORD`; local dev fallback password is `strategy`.
- `proxy.ts` route protection plus server-side auth checks in mutations.
- Turso/libSQL database layer using `@libsql/client`; falls back to `strategy-tracker.local.db` when Turso env vars are absent.
- Runtime SQLite schema initialization for bots, bot modes, instruments, runs, imports, trade summaries, daily metrics, golden baselines, market bars, and combos.
- Curated bot, bot-mode, and instrument management under `/settings`; imports select bot, mode, and instrument from dropdowns.
- NinjaTrader Strategy Analyzer summary CSV parser for the example export in `examples/`.
- Import form for missing metadata: bot, bot mode, instrument, run name, timeframe, settings JSON, tags, notes.
- Bot load text paste parser that can auto-select saved bot, mode, and instrument from lines like `Bot loaded:`, `Mode:`, and `Instrument:`.
- Raw CSV storage with SHA-256 hash and normalized trade rows.
- Run library, run detail page, golden baseline pinning, compare page, combo workbench, and market-data page.
- Charts for equity curve, daily PnL, and PnL distribution.
- Metrics for net PnL, win rate, profit factor, expectancy, drawdown, MAE/MFE/ETD, daily aggregation, and golden deltas.
- Yahoo futures daily-bar fetch/cache path via `yahoo-finance2`.
- Python analysis service contract in `docs/python-analysis-service.md`.
- Scheduled-task friendly JSON database backup script via `npm run backup:db`, writing to `BACKUP_DIR`.
- Tests for CSV parsing, currency parsing, session trading-date assignment, and run/daily metrics.

## Partially Implemented Or Deferred

- Drizzle ORM schema definitions exist, but there is no Drizzle migration CLI workflow yet; schema is currently initialized at runtime.
- CSV upload imports immediately; there is no separate preview/confirm/reprocess screen.
- Instruments must be created in settings before import; session start hour and Yahoo symbol are stored per instrument.
- Yahoo data can be fetched and cached, but run detail pages do not yet overlay ATR/range/gap values against strategy days.
- Regime discovery views are not built yet, so questions like “does this win on high ATR days?” are not automated in the UI.
- Combo analysis supports weighted daily aggregation, but deeper correlation tables and “only A won / only B won / both won” breakdowns need more UI.
- Golden comparison has summary deltas, but not a full day-by-day difference explorer.
- The current NT export does not include side, entry/exit prices, quantity, or holding time, so those analyses are not possible until a richer export is added.
- Python/ML is documented only; no Next.js API stub or Python service is implemented.
- Browser/integration tests for login, bot/mode creation, import, golden pinning, combos, and market refresh are still needed.

## Useful Commands

```bash
npm run dev
npm run test
npm run lint
npm run build
npm run backup:db
```

## Required Environment

```env
AUTH_SECRET=...
STRATEGY_TRACKER_PASSWORD=...
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
BACKUP_DIR=...
```

If `TURSO_DATABASE_URL` is absent, the app uses `strategy-tracker.local.db`, which is ignored by git.
If `BACKUP_DIR` is absent, backups are written to `./backups`, which is also ignored by git.

## Recommended Next Steps

1. Add an import preview/confirmation page that shows parsed row count, first/last trade, total PnL, date range, and warnings before saving.
2. Add a day-difference explorer for candidate run vs golden run with daily PnL deltas and shared/missing trading days.
3. Join cached market bars to daily run metrics and add ATR/range/gap-conditioned performance panels.
4. Expand combo analytics with correlation, overlap buckets, and per-day contribution tables.
5. Add Drizzle migration scripts so Turso schema changes are explicit and reproducible.
6. Add Playwright tests for the core workflow: login, create bot/mode, upload sample CSV, pin golden, compare, and build a combo.
