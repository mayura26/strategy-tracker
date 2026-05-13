import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteComboAction, updateComboAction } from "@/app/actions";
import {
  buildWeightedCombo,
  type ComboConfigItem,
  weightsFromComboConfig,
} from "@/lib/combo-analytics";
import {
  type ComboSourceRun,
  getSavedCombo,
  listComboSourceRuns,
} from "@/lib/db/repository";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  toneClass,
} from "@/lib/format";

export default async function ComboDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [combo, runs] = await Promise.all([
    getSavedCombo(id),
    listComboSourceRuns(),
  ]);

  if (!combo) {
    notFound();
  }

  const config = parseComboConfig(combo.configJson);
  const weights = weightsFromComboConfig(config);
  const selectedRuns = runs.filter((run) => weights[run.id] !== undefined);
  const result = buildWeightedCombo(selectedRuns, weights);
  const missingRuns = config.filter(
    (item) => !runs.some((run) => run.id === item.runId),
  );

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <Link className="link-text text-sm font-semibold" href="/combos">
            Back to combos
          </Link>
          <h1 className="mt-2">{combo.name}</h1>
          <p>{combo.description || "Saved weighted strategy overlay."}</p>
        </div>
        <p className="quiet-text text-sm">
          Updated {formatDate(combo.updatedAt)}
        </p>
      </section>

      <section className="metric-grid">
        <Metric
          label="Net PnL"
          tone={result.netProfit}
          value={formatCurrency(result.netProfit)}
        />
        <Metric
          label="Max drawdown"
          tone={result.maxDrawdown}
          value={formatCurrency(result.maxDrawdown)}
        />
        <Metric label="Win days" value={formatPercent(result.winDayRate)} />
        <Metric label="All win days" value={String(result.allWinDays)} />
        <Metric label="Mixed days" value={String(result.mixedDays)} />
        <Metric label="Correlation" value={formatNumber(result.correlation)} />
      </section>

      {missingRuns.length > 0 ? (
        <section className="panel border-amber-400/30">
          <div className="section-title">
            <h2>Missing source runs</h2>
            <p>{missingRuns.length} saved component ids were not found.</p>
          </div>
          <ul className="grid gap-2 text-sm text-amber-100">
            {missingRuns.map((item) => (
              <li key={item.runId}>
                {item.runId} at weight {item.weight}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-title">
          <h2>Edit combo</h2>
          <p>{selectedRuns.length} weighted source runs.</p>
        </div>
        <form action={updateComboAction} className="grid gap-4">
          <input name="comboId" type="hidden" value={combo.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="label-text">Name</span>
              <input
                className="input"
                defaultValue={combo.name}
                name="name"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="label-text">Description</span>
              <input
                className="input"
                defaultValue={combo.description}
                name="description"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Scope</th>
                  <th>Weight</th>
                  <th>Run PnL</th>
                  <th>Weighted PnL</th>
                </tr>
              </thead>
              <tbody>
                {selectedRuns.map((run) => (
                  <ComponentRow
                    key={run.id}
                    run={run}
                    weight={weights[run.id]}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <button className="primary-button" type="submit">
              Save changes
            </button>
          </div>
        </form>
      </section>

      <section className="panel overflow-x-auto">
        <div className="section-title">
          <h2>Contribution days</h2>
          <p>Largest combined daily outcomes.</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Total</th>
              <th>Best component</th>
              <th>Worst component</th>
              <th>Active runs</th>
            </tr>
          </thead>
          <tbody>
            {result.topDays.map((day) => (
              <tr key={day.tradingDate}>
                <td>{day.tradingDate}</td>
                <td className={toneClass(day.total)}>
                  {formatCurrency(day.total)}
                </td>
                <td>
                  <span className={toneClass(day.best.value)}>
                    {day.best.name}: {formatCurrency(day.best.value)}
                  </span>
                </td>
                <td>
                  <span className={toneClass(day.worst.value)}>
                    {day.worst.name}: {formatCurrency(day.worst.value)}
                  </span>
                </td>
                <td>{day.activeRuns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel border-rose-400/30">
        <div className="section-title">
          <h2>Delete combo</h2>
          <p>Remove this saved overlay from the combo library.</p>
        </div>
        <form action={deleteComboAction}>
          <input name="comboId" type="hidden" value={combo.id} />
          <button className="ghost-button text-rose-300" type="submit">
            Delete combo
          </button>
        </form>
      </section>
    </div>
  );
}

function ComponentRow({
  run,
  weight,
}: {
  run: ComboSourceRun;
  weight: number;
}) {
  const weightedPnl = run.netProfit * weight;

  return (
    <tr>
      <td>
        <input name="componentRunId" type="hidden" value={run.id} />
        <Link className="link-text" href={`/runs/${run.id}`}>
          {run.name}
        </Link>
      </td>
      <td>
        {run.botName} / {run.botModeName ?? "No mode"} / {run.instrumentSymbol}{" "}
        / {run.timeframe}
      </td>
      <td>
        <input
          className="input min-w-24"
          defaultValue={weight}
          name={`weight:${run.id}`}
          step="0.25"
          type="number"
        />
      </td>
      <td className={toneClass(run.netProfit)}>
        {formatCurrency(run.netProfit)}
      </td>
      <td className={toneClass(weightedPnl)}>{formatCurrency(weightedPnl)}</td>
    </tr>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number;
}) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong className={tone === undefined ? "" : toneClass(tone)}>
        {value}
      </strong>
    </div>
  );
}

function parseComboConfig(configJson: string): ComboConfigItem[] {
  const parsed = JSON.parse(configJson);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => ({
      runId: String(item?.runId ?? ""),
      weight: Number(item?.weight ?? 0),
    }))
    .filter((item) => item.runId && Number.isFinite(item.weight));
}
