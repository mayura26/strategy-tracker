"use client";

import { BrainCircuit, Crown, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { createRegimeAnalysisJobAction, deleteRunsAction } from "@/app/actions";
import type { RunSummary } from "@/lib/db/repository";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  toneClass,
} from "@/lib/format";

export function RunsLibraryTable({ runs }: { runs: RunSummary[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) {
      return;
    }
    el.indeterminate =
      selected.size > 0 && selected.size < runs.length && runs.length > 0;
  }, [selected, runs.length]);

  const toggleOne = useCallback((runId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(runId);
      } else {
        next.delete(runId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelected(new Set(runs.map((run) => run.id)));
      } else {
        setSelected(new Set());
      }
    },
    [runs],
  );

  function confirmBulkDelete(event: FormEvent<HTMLFormElement>) {
    const count = selected.size;
    if (count === 0) {
      event.preventDefault();
      return;
    }
    if (
      !window.confirm(
        `Delete ${count} run${count === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      event.preventDefault();
    }
  }

  const allSelected = runs.length > 0 && selected.size === runs.length;

  useEffect(() => {
    const visible = new Set(runs.map((r) => r.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size && [...next].every((id) => prev.has(id))
        ? prev
        : next;
    });
  }, [runs]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
            <input
              checked={allSelected}
              className="size-4 rounded border-slate-600 bg-slate-900"
              onChange={(event) => toggleAll(event.target.checked)}
              ref={selectAllRef}
              type="checkbox"
            />
            <span>Select all in view</span>
          </label>
          <span className="quiet-text text-sm">{selected.size} selected</span>
        </div>
        <form action={deleteRunsAction} onSubmit={confirmBulkDelete}>
          {[...selected].map((id) => (
            <input key={id} name="runId" type="hidden" value={id} />
          ))}
          <button
            className="ghost-button border border-rose-500/35 bg-rose-950/25 text-rose-100 hover:bg-rose-950/40"
            disabled={selected.size === 0}
            type="submit"
          >
            <Trash2 aria-hidden size={16} />
            Delete selected
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10" scope="col" />
              <th>Run</th>
              <th>Scope</th>
              <th>Trades</th>
              <th>Net PnL</th>
              <th>Win</th>
              <th>PF</th>
              <th>Drawdown</th>
              <th>Data period</th>
              <th>Imported</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <input
                    aria-label={`Select ${run.name}`}
                    checked={selected.has(run.id)}
                    className="size-4 rounded border-slate-600 bg-slate-900"
                    onChange={(event) =>
                      toggleOne(run.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                </td>
                <td>
                  <Link
                    className="link-text inline-flex items-center gap-2 font-semibold"
                    href={`/runs/${run.id}`}
                  >
                    {run.isGolden ? <Crown aria-hidden size={15} /> : null}
                    {run.name}
                  </Link>
                </td>
                <td className="quiet-text">
                  {run.botName} / {run.botModeName ?? "No mode"} /{" "}
                  {run.instrumentSymbol} / {run.timeframe}
                </td>
                <td>{run.tradeCount}</td>
                <td className={toneClass(run.netProfit)}>
                  {formatCurrency(run.netProfit)}
                </td>
                <td>{formatPercent(run.winRate)}</td>
                <td>{formatNumber(run.profitFactor)}</td>
                <td className={toneClass(run.maxDrawdown)}>
                  {formatCurrency(run.maxDrawdown)}
                </td>
                <td>
                  <span className="rounded-sm border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-200">
                    {formatCoverage(run)}
                  </span>
                </td>
                <td>{formatDate(run.createdAt)}</td>
                <td>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      className="ghost-button min-h-9 px-3"
                      href={`/runs/${run.id}`}
                    >
                      Open
                    </Link>
                    <form action={createRegimeAnalysisJobAction}>
                      <input name="runId" type="hidden" value={run.id} />
                      <button
                        className="ghost-button min-h-9 px-3"
                        type="submit"
                      >
                        <BrainCircuit aria-hidden size={15} />
                        Analyze
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCoverage(run: {
  coverageStartDate: string | null;
  coverageEndDate: string | null;
}) {
  if (!run.coverageStartDate || !run.coverageEndDate) {
    return "n/a";
  }

  return `${run.coverageStartDate} to ${run.coverageEndDate}`;
}
