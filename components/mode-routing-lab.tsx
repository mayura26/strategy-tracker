"use client";

import { useMemo, useState } from "react";

import { ModeSwitchLab } from "@/components/comparison-workbench";
import type {
  AnalysisSettings,
  ComparisonGroup,
  ComparisonRun,
} from "@/lib/db/repository";

export function ModeRoutingLab({
  groups,
  analysisSettings,
}: {
  groups: ComparisonGroup[];
  analysisSettings: AnalysisSettings;
}) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [modeAIdByGroup, setModeAIdByGroup] = useState<Record<string, string>>(
    {},
  );
  const [modeBIdByGroup, setModeBIdByGroup] = useState<Record<string, string>>(
    {},
  );

  const routeableGroups = useMemo(
    () => groups.filter((candidate) => candidate.runs.length > 1),
    [groups],
  );
  const group = routeableGroups[groupIndex] ?? routeableGroups[0];
  const defaultModeA =
    group?.runs.find((run) => run.isGolden) ?? group?.runs[0] ?? null;
  const modeA =
    group?.runs.find((run) => run.id === modeAIdByGroup[group.scope]) ??
    defaultModeA;
  const modeB =
    group && modeA
      ? (group.runs.find((run) => run.id === modeBIdByGroup[group.scope]) ??
        defaultModeBRun(group.runs, modeA))
      : null;

  if (groups.length === 0) {
    return (
      <section className="panel grid min-h-72 place-items-center text-center">
        <div>
          <p className="empty-title text-lg font-semibold">
            Import more runs before routing modes.
          </p>
          <p className="quiet-text mt-2 text-sm">
            Mode routing needs at least two runs in the same bot, instrument,
            and timeframe scope.
          </p>
        </div>
      </section>
    );
  }

  if (!group || !modeA || !modeB || routeableGroups.length === 0) {
    return (
      <section className="panel grid min-h-72 place-items-center text-center">
        <div>
          <p className="empty-title text-lg font-semibold">
            No routeable mode pairs yet.
          </p>
          <p className="quiet-text mt-2 text-sm">
            Import two modes under the same bot/instrument/timeframe to test a
            signal-based handoff.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="panel grid gap-4 xl:grid-cols-[1fr_240px_240px]">
        <div className="xl:col-span-3">
          <div className="section-title">
            <div>
              <h2>Mode routing lab</h2>
              <p>
                Route one mode per day from prior-session signals, with the
                unselected mode treated as zero exposure or cash.
              </p>
            </div>
          </div>
        </div>
        <label className="grid gap-2">
          <span className="label-text">Routing scope</span>
          <select
            className="input"
            onChange={(event) => setGroupIndex(Number(event.target.value))}
            value={groupIndex}
          >
            {routeableGroups.map((candidateGroup, index) => (
              <option key={candidateGroup.scope} value={index}>
                {candidateGroup.scope}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="label-text">Mode A run</span>
          <select
            className="input"
            onChange={(event) => {
              const nextModeAId = event.target.value;
              setModeAIdByGroup((current) => ({
                ...current,
                [group.scope]: nextModeAId,
              }));

              if (nextModeAId === modeB.id) {
                const nextModeA = group.runs.find(
                  (run) => run.id === nextModeAId,
                );
                const nextModeB = nextModeA
                  ? defaultModeBRun(group.runs, nextModeA)
                  : null;
                setModeBIdByGroup((current) => ({
                  ...current,
                  [group.scope]: nextModeB?.id ?? nextModeAId,
                }));
              }
            }}
            value={modeA.id}
          >
            {group.runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.botModeName ?? "No mode"} / {run.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="label-text">Mode B run</span>
          <select
            className="input"
            onChange={(event) =>
              setModeBIdByGroup((current) => ({
                ...current,
                [group.scope]: event.target.value,
              }))
            }
            value={modeB.id}
          >
            {group.runs
              .filter((run) => run.id !== modeA.id)
              .map((run) => (
                <option key={run.id} value={run.id}>
                  {run.botModeName ?? "No mode"} / {run.name}
                </option>
              ))}
          </select>
        </label>
      </section>

      <ModeSwitchLab
        analysisSettings={analysisSettings}
        group={group}
        marketBars={group.marketBars}
        modeA={modeA}
        modeB={modeB}
      />
    </div>
  );
}

function defaultModeBRun(runs: ComparisonRun[], modeA: ComparisonRun) {
  return (
    runs.find(
      (run) => run.id !== modeA.id && run.botModeName !== modeA.botModeName,
    ) ??
    runs.find((run) => run.id !== modeA.id) ??
    modeA
  );
}
