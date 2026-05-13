import Link from "next/link";

import { ComboWorkbench } from "@/components/combo-workbench";
import { listComboSourceRuns, listSavedCombos } from "@/lib/db/repository";
import { formatDate } from "@/lib/format";

export default async function CombosPage() {
  const [runs, savedCombos] = await Promise.all([
    listComboSourceRuns(),
    listSavedCombos(),
  ]);

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Combos</h1>
          <p>
            Overlay strategies to spot regimes where one mode should hand off to
            another.
          </p>
        </div>
      </section>
      {savedCombos.length > 0 ? (
        <section className="panel overflow-x-auto">
          <div className="section-title">
            <h2>Saved combos</h2>
            <p>{savedCombos.length} saved research overlays.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {savedCombos.map((combo) => (
                <tr key={combo.id}>
                  <td>
                    <Link className="link-text" href={`/combos/${combo.id}`}>
                      {combo.name}
                    </Link>
                  </td>
                  <td>{combo.description || "n/a"}</td>
                  <td>{formatDate(combo.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {runs.length === 0 ? (
        <section className="panel grid min-h-80 place-items-center text-center">
          <div>
            <p className="empty-title text-lg font-semibold">
              Import runs before building combos.
            </p>
            <p className="quiet-text mt-2 text-sm">
              Weighted overlays need daily run metrics from uploaded exports.
            </p>
          </div>
        </section>
      ) : (
        <ComboWorkbench runs={runs} />
      )}
    </div>
  );
}
