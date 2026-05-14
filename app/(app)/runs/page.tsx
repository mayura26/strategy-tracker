import { Plus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { RunsLibraryTable } from "@/components/runs-library-table";
import { listRuns } from "@/lib/db/repository";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

type RunFilters = {
  q?: string;
  bot?: string;
  mode?: string;
  instrument?: string;
  timeframe?: string;
  golden?: string;
  sort?: string;
};

export default async function RunsPage({
  searchParams,
}: {
  searchParams?: Promise<RunFilters>;
}) {
  const params = await (searchParams ?? Promise.resolve({} as RunFilters));
  const runs = await listRuns();
  const filteredRuns = sortRuns(filterRuns(runs, params), params.sort);
  const totalPnl = filteredRuns.reduce((sum, run) => sum + run.netProfit, 0);
  const allRunsPnl = runs.reduce((sum, run) => sum + run.netProfit, 0);
  const goldenCount = filteredRuns.filter((run) => run.isGolden).length;
  const winningRuns = filteredRuns.filter((run) => run.netProfit > 0).length;
  const filterOptions = buildFilterOptions(runs);

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Runs</h1>
          <p>Catalogue NinjaTrader summaries and compare research baselines.</p>
        </div>
        <Link className="primary-button" href="/runs/new">
          <Plus aria-hidden size={16} />
          Import CSV
        </Link>
      </section>

      <section className="metric-grid">
        <Metric
          detail={
            runs.length === filteredRuns.length
              ? "All imported"
              : `${runs.length} total`
          }
          label="Visible runs"
          value={String(filteredRuns.length)}
        />
        <Metric label="Golden baselines" value={String(goldenCount)} />
        <Metric
          detail={
            runs.length === filteredRuns.length
              ? undefined
              : `${formatCurrency(allRunsPnl)} all runs`
          }
          label="Visible PnL"
          value={formatCurrency(totalPnl)}
        />
        <Metric
          label="Avg profit factor"
          value={formatNumber(
            average(
              filteredRuns.map((run) => run.profitFactor).filter(isNumber),
            ),
          )}
        />
        <Metric
          detail={
            filteredRuns.length > 0
              ? `${formatPercent(winningRuns / filteredRuns.length)} of visible`
              : "No visible runs"
          }
          label="Winning runs"
          value={String(winningRuns)}
        />
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Library filters</h2>
            <p>Search by run, bot, mode, instrument, tags, or timeframe.</p>
          </div>
          <SlidersHorizontal aria-hidden className="text-amber-300" size={20} />
        </div>
        <form className="grid gap-3 xl:grid-cols-[1.35fr_repeat(6,minmax(0,1fr))_auto]">
          <label className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={16}
            />
            <input
              className="input pl-9"
              defaultValue={params.q ?? ""}
              name="q"
              placeholder="Search runs"
            />
          </label>
          <FilterSelect
            label="All bots"
            name="bot"
            options={filterOptions.bots}
            value={params.bot}
          />
          <FilterSelect
            label="All modes"
            name="mode"
            options={filterOptions.modes}
            value={params.mode}
          />
          <FilterSelect
            label="All instruments"
            name="instrument"
            options={filterOptions.instruments}
            value={params.instrument}
          />
          <FilterSelect
            label="All timeframes"
            name="timeframe"
            options={filterOptions.timeframes}
            value={params.timeframe}
          />
          <select
            className="input"
            defaultValue={params.golden ?? ""}
            name="golden"
          >
            <option value="">All baselines</option>
            <option value="true">Golden only</option>
            <option value="false">Non-golden</option>
          </select>
          <select
            className="input"
            defaultValue={params.sort ?? ""}
            name="sort"
          >
            <option value="">Newest</option>
            <option value="pnl-desc">PnL high to low</option>
            <option value="pnl-asc">PnL low to high</option>
            <option value="drawdown-desc">Drawdown best</option>
            <option value="win-desc">Win rate high</option>
            <option value="period-desc">Latest data</option>
          </select>
          <div className="flex gap-2">
            <button className="primary-button whitespace-nowrap" type="submit">
              Apply
            </button>
            <Link className="ghost-button whitespace-nowrap" href="/runs">
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="panel overflow-x-auto">
        {runs.length === 0 ? (
          <div className="grid min-h-80 place-items-center text-center">
            <div>
              <p className="empty-title text-lg font-semibold">
                No runs imported yet.
              </p>
              <p className="quiet-text mt-2 text-sm">
                Start with the NinjaTrader CSV in your examples folder.
              </p>
            </div>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="grid min-h-80 place-items-center text-center">
            <div>
              <p className="empty-title text-lg font-semibold">
                No runs match those filters.
              </p>
              <p className="quiet-text mt-2 text-sm">
                Clear the filters or widen the search to bring more runs back
                into view.
              </p>
            </div>
          </div>
        ) : (
          <RunsLibraryTable runs={filteredRuns} />
        )}
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: string[];
  value: string | undefined;
}) {
  return (
    <select className="input" defaultValue={value ?? ""} name={name}>
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p className="quiet-text mt-2 text-sm">{detail}</p> : null}
    </div>
  );
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isNumber(value: number | null): value is number {
  return value !== null;
}

function filterRuns(
  runs: Awaited<ReturnType<typeof listRuns>>,
  params: RunFilters,
) {
  const query = params.q?.trim().toLowerCase() ?? "";

  return runs.filter((run) => {
    const haystack = [
      run.name,
      run.botName,
      run.botModeName ?? "",
      run.instrumentSymbol,
      run.timeframe,
      run.tags,
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!query || haystack.includes(query)) &&
      (!params.bot || run.botName === params.bot) &&
      (!params.mode || (run.botModeName ?? "No mode") === params.mode) &&
      (!params.instrument || run.instrumentSymbol === params.instrument) &&
      (!params.timeframe || run.timeframe === params.timeframe) &&
      (params.golden !== "true" || run.isGolden) &&
      (params.golden !== "false" || !run.isGolden)
    );
  });
}

function sortRuns(
  runs: Awaited<ReturnType<typeof listRuns>>,
  sort: string | undefined,
) {
  return [...runs].sort((left, right) => {
    if (sort === "pnl-desc") {
      return right.netProfit - left.netProfit;
    }

    if (sort === "pnl-asc") {
      return left.netProfit - right.netProfit;
    }

    if (sort === "drawdown-desc") {
      return right.maxDrawdown - left.maxDrawdown;
    }

    if (sort === "win-desc") {
      return right.winRate - left.winRate;
    }

    if (sort === "period-desc") {
      return dateValue(right.coverageEndDate) - dateValue(left.coverageEndDate);
    }

    return dateValue(right.createdAt) - dateValue(left.createdAt);
  });
}

function buildFilterOptions(runs: Awaited<ReturnType<typeof listRuns>>) {
  return {
    bots: uniqueSorted(runs.map((run) => run.botName)),
    instruments: uniqueSorted(runs.map((run) => run.instrumentSymbol)),
    modes: uniqueSorted(runs.map((run) => run.botModeName ?? "No mode")),
    timeframes: uniqueSorted(runs.map((run) => run.timeframe)),
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function dateValue(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}
