import { ComparisonWorkbench } from "@/components/comparison-workbench";
import { getAnalysisSettings, listComparisonGroups } from "@/lib/db/repository";

export default async function ComparePage() {
  const [groups, analysisSettings] = await Promise.all([
    listComparisonGroups(),
    getAnalysisSettings(),
  ]);

  return (
    <div className="grid gap-6">
      <section className="section-title">
        <div>
          <h1>Compare</h1>
          <p>
            Explore run quality through daily overlays, filters, box plots, and
            outlier shape.
          </p>
        </div>
      </section>
      <ComparisonWorkbench
        analysisSettings={analysisSettings}
        groups={groups}
      />
    </div>
  );
}
