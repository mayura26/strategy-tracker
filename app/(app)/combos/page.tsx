import { ComboWorkbench } from "@/components/combo-workbench";
import { listComboSourceRuns } from "@/lib/db/repository";

export default async function CombosPage() {
  const runs = await listComboSourceRuns();

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
