import { ComparisonWorkbench } from "@/components/comparison-workbench";
import { listComparisonGroups } from "@/lib/db/repository";

export default async function ComparePage() {
  const groups = await listComparisonGroups();

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
      <ComparisonWorkbench groups={groups} />
    </div>
  );
}
