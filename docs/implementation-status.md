# Strategy Tracker Implementation Status

Last updated: 2026-05-13

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
- Run detail market-regime analysis that joins daily PnL to cached ATR/range/gap/close values.
- Run detail golden day-difference table showing largest daily divergences vs the pinned baseline.
- Combo workbench overlap analytics with all-win, mixed-day, correlation, and component contribution table.
- Visual comparison workspace with scoped run selection, core metric bars, filtered daily PnL overlays, box plots, and dot/strip plots.
- Comparison analytics helpers for distribution quartiles, whiskers, outliers, daily alignment, similarity filtering, and day buckets.
- Python analysis service contract in `docs/python-analysis-service.md`.
- Scheduled-task friendly JSON database backup script via `npm run backup:db`, writing to `BACKUP_DIR`.
- Tests for CSV parsing, currency parsing, session trading-date assignment, and run/daily metrics.

## Partially Implemented Or Deferred

- Drizzle ORM schema definitions exist, but there is no Drizzle migration CLI workflow yet; schema is currently initialized at runtime.
- CSV upload imports immediately; there is no separate preview/confirm/reprocess screen.
- Instruments must be created in settings before import; session start hour and Yahoo symbol are stored per instrument.
- Regime discovery is currently descriptive, not ML/rule-mining; it shows ATR/range buckets but does not yet propose optimized thresholds.
- Comparison charts use custom SVG/HTML primitives; there is no zoom/brush interaction yet.
- Combo analysis has overlap buckets and contribution days, but saved combo detail pages are not built yet.
- Golden comparison has a day-difference table, but no filtering/drilldown controls yet.
- The current NT export does not include side, entry/exit prices, quantity, or holding time, so those analyses are not possible until a richer export is added.
- Python/ML is documented only; no Next.js API stub or Python service is implemented.
- Browser/integration tests for login, bot/mode/instrument creation, import, golden pinning, combos, and market refresh are still needed.

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
2. Add zoom/brush and richer tooltips to comparison charts if the custom primitives become too limited.
3. Add an automatic threshold discovery panel for ATR/range/gap conditions.
4. Add saved combo detail pages with historical combo results.
5. Add Drizzle migration scripts so Turso schema changes are explicit and reproducible.
6. Add Playwright tests for the core workflow: login, create bot/mode/instrument, upload sample CSV, pin golden, compare, and build a combo.
