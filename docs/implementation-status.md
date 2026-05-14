# Strategy Tracker Implementation Status

Last updated: 2026-05-13

## Implemented

- Next.js 16 App Router application shell with protected routes.
- Auth.js credentials login using `STRATEGY_TRACKER_PASSWORD`; local dev fallback password is `strategy`.
- `proxy.ts` route protection plus server-side auth checks in mutations.
- Turso/libSQL database layer using `@libsql/client`; falls back to `strategy-tracker.local.db` when Turso env vars are absent.
- Runtime SQLite schema initialization plus Drizzle migrations for bots, bot modes, instruments, runs, imports, trade summaries, daily metrics, golden baselines, market bars, combos, combo versions, and analysis settings.
- Curated bot, bot-mode, and instrument management under `/settings`; imports select bot, mode, and instrument from dropdowns.
- NinjaTrader Strategy Analyzer summary CSV parser for the example export in `examples/`.
- Import form for missing metadata: bot, bot mode, instrument, run name, timeframe, settings JSON, tags, notes.
- Import preview/confirmation flow showing parsed trade count, date range, first/last trade, core metrics, largest daily moves, and data-quality warnings before saving.
- Bot load text paste parser that can auto-select saved bot, mode, and instrument from lines like `Bot loaded:`, `Mode:`, and `Instrument:`.
- Raw CSV storage with SHA-256 hash and normalized trade rows.
- Run library, run detail page, data-period coverage markers, golden baseline pinning, compare page, combo workbench, and market-data page.
- Day-centric charts for equity curve, daily PnL, and daily/session PnL distribution.
- Metrics for net PnL, win rate, profit factor, expectancy, drawdown, MAE/MFE/ETD, daily aggregation, and golden deltas.
- Yahoo futures daily-bar fetch/cache path via `yahoo-finance2`.
- Run detail market-regime analysis that joins daily PnL to cached ATR/range/gap/close values.
- Run detail underlying instrument chart with cached OHLC candlesticks and daily PnL bars.
- Run detail predictive regime discovery with adjustable ATR/RSI thresholds, configurable EMA/RSI periods, previous-day ATR/RSI/EMA features, and chronological validation.
- Analysis job queue with immutable regime-discovery snapshots, local heuristic results, `/analysis` UI, and authenticated `/api/analysis/jobs` route handlers for future Python worker integration.
- Run detail golden daily drilldown with overlap coverage, filters, outperformance thresholds, visual PnL overlay, delta histogram, and collapsible day table.
- Combo workbench overlap analytics with all-win, mixed-day, correlation, and component contribution table.
- Saved combo library and detail pages with weighted source runs, combo metrics, missing-run warnings, contribution days, and version history snapshots.
- Visual comparison workspace with scoped run selection, overlap-only or union date handling, core metric bars, outperformance-vs counts with material-delta filtering, filtered daily PnL overlays, green/red day summaries, daily PnL histograms, and daily/session box and dot plots.
- Comparison analytics helpers for distribution quartiles, whiskers, outliers, daily histograms, outcome summaries, outperformance summaries, overlap/union daily alignment, similarity filtering, and day buckets.
- Python analysis service contract in `docs/python-analysis-service.md`; the Next.js app now stores compatible job snapshots and local heuristic results.
- Scheduled-task friendly JSON database backup script via `npm run backup:db`, writing to `BACKUP_DIR`.
- Tests for CSV parsing, import preview, currency parsing, session trading-date assignment, run/daily metrics, comparison analytics, combo analytics, and regime threshold discovery.

## Partially Implemented Or Deferred

- Runtime schema initialization remains as a compatibility safety net while migrations are introduced.
- CSV imports now preview before saving, but there is no stored reprocess workflow for old imports yet.
- Instruments must be created in settings before import; session start hour and Yahoo symbol are stored per instrument.
- Regime discovery is currently heuristic and predictive-feature based; it does not yet train ML models.
- Comparison charts use custom SVG/HTML primitives; there is no zoom/brush interaction yet.
- Python worker execution is still deferred; current analysis jobs complete synchronously using local heuristic regime discovery.

## Useful Commands

```bash
npm run dev
npm run test
npm run lint
npm run build
npm run backup:db
npm run db:generate
npm run db:migrate
```

## Required Environment

```env
AUTH_SECRET=...
AUTH_URL=https://your-domain.example
AUTH_TRUST_HOST=true
STRATEGY_TRACKER_PASSWORD=...
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
BACKUP_DIR=...
```

If `TURSO_DATABASE_URL` is absent, the app uses `strategy-tracker.local.db`, which is ignored by git.
If `BACKUP_DIR` is absent, backups are written to `./backups`, which is also ignored by git.

## Recommended Next Steps

1. Add zoom/brush and richer tooltips to comparison charts if the custom primitives become too limited.
2. Add Playwright tests for the core workflow: login, create bot/mode/instrument, upload sample CSV, pin golden, compare, and build a combo.
3. Add a Python worker that consumes stored analysis job snapshots and writes richer ML validation results back to the app.
