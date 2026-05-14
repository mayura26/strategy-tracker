# Python Analysis Service Contract

This app keeps the web surface focused on import, curation, comparison, and visual exploration. Heavier modelling can live in a Python service that receives normalized strategy data and returns research outputs.

## Job Request

`POST /analysis/jobs`

```json
{
  "jobType": "regime-discovery",
  "runs": [
    {
      "runId": "uuid",
      "bot": "Grid Bot",
      "instrument": "ES",
      "timeframe": "5m",
      "settings": {},
      "isGolden": true
    }
  ],
  "trades": [
    {
      "runId": "uuid",
      "tradeNumber": 1,
      "closeTimeUtc": "2026-02-23T02:25:00.000Z",
      "tradingDate": "2026-02-23",
      "netProfit": -120,
      "cumulativeNetProfit": -120,
      "mae": 120,
      "mfe": 0,
      "etd": 120
    }
  ],
  "dailyMetrics": [
    {
      "runId": "uuid",
      "tradingDate": "2026-02-23",
      "netProfit": 100,
      "tradeCount": 3,
      "maxDrawdown": -125
    }
  ],
  "marketBars": [
    {
      "instrument": "ES",
      "tradingDate": "2026-02-23",
      "open": 0,
      "high": 0,
      "low": 0,
      "close": 0,
      "atr14": 0,
      "gap": 0
    }
  ]
}
```

## Job Response

```json
{
  "jobId": "uuid",
  "status": "queued"
}
```

`GET /analysis/jobs/{jobId}` returns:

```json
{
  "jobId": "uuid",
  "status": "complete",
  "summary": "Mode 1 outperformed on high ATR sessions.",
  "factors": [
    {
      "name": "atr14",
      "direction": "greater_than",
      "threshold": 82.5,
      "lift": 0.31,
      "supportDays": 42
    }
  ],
  "runComparisons": [
    {
      "runId": "uuid",
      "goldenRunId": "uuid",
      "explanation": "Loss days cluster around low range and gap-down sessions."
    }
  ],
  "artifacts": [
    {
      "type": "markdown",
      "title": "Regime report",
      "content": "..."
    }
  ]
}
```

## First Analyses

- Regime discovery: rank ATR, range, gap, weekday, and rolling volatility features by their relationship to daily PnL.
- Golden difference analysis: identify days where a candidate run materially diverges from the golden run and summarize market conditions.
- Combo handoff analysis: find thresholds where one weighted strategy mode should replace another.
- Robustness checks: report support size, train/test split performance, and whether a rule is likely overfit.

## Integration Notes

- The Next.js app should submit immutable snapshots rather than letting Python query Turso directly.
- Python should return explanations plus machine-readable factors so the web UI can render tables, thresholds, and charts.
- Long-running jobs should be asynchronous: queued, running, complete, failed.
- The service must treat Yahoo-derived values as cached enrichment, not authoritative market data.

## Current Next.js Stub

- `/analysis` can create stored `regime-discovery` jobs from an existing run.
- `GET /api/analysis/jobs` lists stored jobs for the authenticated user session.
- `POST /api/analysis/jobs` accepts `{ "jobType": "regime-discovery", "runId": "..." }`.
- `GET /api/analysis/jobs/{jobId}` returns one stored job.
- Until a Python worker is attached, jobs complete synchronously with local heuristic predictive-regime results.
