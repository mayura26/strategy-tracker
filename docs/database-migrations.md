# Database Migrations

Strategy Tracker currently keeps runtime schema initialization in place for
backwards compatibility with existing local and Turso databases. New schema work
should also be captured as Drizzle migrations so fresh environments are
reproducible and future production changes are reviewable.

## Commands

```bash
npm run db:generate
npm run db:migrate
```

`db:generate` reads `lib/db/schema.ts` through `drizzle.config.ts` and writes SQL
into `drizzle/`.

`db:migrate` applies unapplied migrations to the database selected by:

```env
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
```

If `TURSO_DATABASE_URL` is not set, the commands use
`file:strategy-tracker.local.db`.

## Existing Databases

The initial migration is a baseline for fresh databases. Existing databases that
were already initialized by the app may already contain these tables, so do not
run the baseline migration against those databases unless you have verified the
Drizzle migrations table state and taken a backup first.

The app still calls runtime `ensureSchema()` as a compatibility safety net. Over
time, new schema changes should be generated into explicit migrations before
being deployed.
