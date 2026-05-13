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
- Import preview/confirmation flow showing parsed trade count, date range, first/last trade, core metrics, largest daily moves, and data-quality warnings before saving.
- Bot load text paste parser that can auto-select saved bot, mode, and instrument from lines like `Bot loaded:`, `Mode:`, and `Instrument:`.
- Raw CSV storage with SHA-256 hash and normalized trade rows.
- Run library, run detail page, data-period coverage markers, golden baseline pinning, compare page, combo workbench, and market-data page.
- Charts for equity curve, daily PnL, and PnL distribution.
- Metrics for net PnL, win rate, profit factor, expectancy, drawdown, MAE/MFE/ETD, daily aggregation, and golden deltas.
- Yahoo futures daily-bar fetch/cache path via `yahoo-finance2`.
- Run detail market-regime analysis that joins daily PnL to cached ATR/range/gap/close values.
- Run detail threshold discovery that ranks ATR, range, gap, and absolute-gap conditions by average-PnL lift and out-of-sample validation lift.
- Run detail golden day-difference table showing largest daily divergences vs the pinned baseline.
- Combo workbench overlap analytics with all-win, mixed-day, correlation, and component contribution table.
- Saved combo library and detail pages with weighted source runs, combo metrics, missing-run warnings, and contribution days.
- Visual comparison workspace with scoped run selection, overlap-only or union date handling, core metric bars, outperformance-vs counts with material-delta filtering, filtered daily PnL overlays, green/red day summaries, daily PnL histograms, box plots, and dot/strip plots.
- Comparison analytics helpers for distribution quartiles, whiskers, outliers, daily histograms, outcome summaries, outperformance summaries, overlap/union daily alignment, similarity filtering, and day buckets.
- Python analysis service contract in `docs/python-analysis-service.md`.
- Scheduled-task friendly JSON database backup script via `npm run backup:db`, writing to `BACKUP_DIR`.
- Tests for CSV parsing, import preview, currency parsing, session trading-date assignment, run/daily metrics, comparison analytics, combo analytics, and regime threshold discovery.

## Partially Implemented Or Deferred

- Drizzle ORM schema definitions exist, but there is no Drizzle migration CLI workflow yet; schema is currently initialized at runtime.
- CSV imports now preview before saving, but there is no stored reprocess workflow for old imports yet.
- Instruments must be created in settings before import; session start hour and Yahoo symbol are stored per instrument.
- Regime discovery is currently heuristic; it proposes ranked thresholds with chronological validation, but does not yet train ML models.
- Comparison charts use custom SVG/HTML primitives; there is no zoom/brush interaction yet.
- Saved combo pages support edit/delete, but there is not yet version history for combo changes.
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
2. Add version history for saved combo changes.
3. Add Drizzle migration scripts so Turso schema changes are explicit and reproducible.
4. Add Playwright tests for the core workflow: login, create bot/mode/instrument, upload sample CSV, pin golden, compare, and build a combo.
5. Add richer ML-style validation for discovered ATR/range/gap thresholds.
