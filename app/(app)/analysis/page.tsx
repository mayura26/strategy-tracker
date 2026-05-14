import { BrainCircuit, Play } from "lucide-react";
import Link from "next/link";

import { createRegimeAnalysisJobAction } from "@/app/actions";
import type { AnalysisJobResult } from "@/lib/analysis-contract";
import { listAnalysisJobs, listRuns } from "@/lib/db/repository";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams?: Promise<{ job?: string }>;
}) {
  const [params, runs, jobs] = await Promise.all([
    searchParams ?? Promise.resolve({} as { job?: string }),
    listRuns(),
    listAnalysisJobs(),
  ]);
  const selectedJobId = params.job;
  const selectedJob =
    jobs.find((job) => job.id === selectedJobId) ?? jobs.at(0) ?? null;
  const selectedResult = selectedJob
    ? parseAnalysisResult(selectedJob.resultJson)
    : null;

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Analysis</h1>
          <p>
            Create immutable research snapshots for local heuristic analysis now
            and Python ML workers later.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="panel h-fit">
          <div className="section-title">
            <div>
              <h2>New regime job</h2>
              <p>Submit a run snapshot with predictive market features.</p>
            </div>
            <BrainCircuit aria-hidden className="text-amber-300" size={22} />
          </div>
          {runs.length === 0 ? (
            <div className="subtle-card p-4 text-sm">
              <p className="empty-title font-semibold">
                Import a run before creating jobs.
              </p>
              <p className="quiet-text mt-2">
                Analysis jobs use daily metrics, trades, cached market bars, and
                predictive regime features from an existing run.
              </p>
            </div>
          ) : (
            <form action={createRegimeAnalysisJobAction} className="grid gap-4">
              <label className="grid gap-2">
                <span className="label-text">Run</span>
                <select className="input" name="runId" required>
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.name} / {run.botName} /{" "}
                      {run.botModeName ?? "No mode"} / {run.instrumentSymbol}
                    </option>
                  ))}
                </select>
              </label>
              <input name="jobType" type="hidden" value="regime-discovery" />
              <button className="primary-button" type="submit">
                <Play aria-hidden size={16} />
                Run regime discovery
              </button>
            </form>
          )}
        </div>

        <div className="panel overflow-x-auto">
          <div className="section-title">
            <div>
              <h2>Job history</h2>
              <p>{jobs.length} stored analysis snapshots.</p>
            </div>
          </div>
          {jobs.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center">
              <div>
                <p className="empty-title text-lg font-semibold">
                  No analysis jobs yet.
                </p>
                <p className="quiet-text mt-2 text-sm">
                  Create a regime job to store the first immutable research
                  snapshot.
                </p>
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const result = parseAnalysisResult(job.resultJson);
                  return (
                    <tr
                      className={
                        job.id === selectedJob?.id
                          ? "bg-amber-400/[0.045]"
                          : undefined
                      }
                      key={job.id}
                    >
                      <td>
                        <Link
                          className="link-text"
                          href={`/analysis?job=${job.id}`}
                        >
                          {formatDate(job.createdAt)}
                        </Link>
                      </td>
                      <td>{job.jobType}</td>
                      <td>
                        <span className={statusClass(job.status)}>
                          {job.status}
                        </span>
                      </td>
                      <td>{result?.summary ?? job.error ?? "Queued"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {selectedJob ? (
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Selected job</h2>
              <p>
                {selectedJob.id.slice(0, 8)} / {selectedJob.jobType} /{" "}
                {selectedJob.status}
              </p>
            </div>
          </div>
          {selectedResult ? (
            <div className="grid gap-4">
              <div className="metric-grid">
                <Metric
                  label="Factors"
                  value={String(selectedResult.factors.length)}
                />
                <Metric
                  label="Validated"
                  value={String(
                    selectedResult.factors.filter((factor) => factor.validated)
                      .length,
                  )}
                />
                <Metric label="Source" value={selectedResult.source} />
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Condition</th>
                      <th>Action</th>
                      <th>Support</th>
                      <th>Lift</th>
                      <th>Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedResult.factors.map((factor) => (
                      <tr key={`${factor.name}-${factor.condition}`}>
                        <td>{factor.condition}</td>
                        <td
                          className={
                            factor.action === "favor"
                              ? "text-emerald-300"
                              : "text-rose-300"
                          }
                        >
                          {factor.action}
                        </td>
                        <td>{factor.supportDays} days</td>
                        <td>{formatCurrency(factor.lift)}</td>
                        <td>
                          {factor.validationLift === null
                            ? "n/a"
                            : formatCurrency(factor.validationLift)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="quiet-text text-sm">
              This job has no result payload yet.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function parseAnalysisResult(value: string | null): AnalysisJobResult | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AnalysisJobResult;
  } catch {
    return null;
  }
}

function statusClass(status: string) {
  if (status === "complete") {
    return "text-emerald-300";
  }

  if (status === "failed") {
    return "text-rose-300";
  }

  return "text-amber-300";
}
