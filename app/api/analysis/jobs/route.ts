import { auth } from "@/auth";
import { createRegimeDiscoveryAnalysisJob } from "@/lib/analysis-service";
import { listAnalysisJobs } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ jobs: await listAnalysisJobs() });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const jobType = String(body?.jobType ?? "");
  const runId = String(body?.runId ?? "");

  if (jobType !== "regime-discovery") {
    return Response.json(
      { error: "Only regime-discovery jobs are supported in V1." },
      { status: 400 },
    );
  }

  if (!runId) {
    return Response.json({ error: "runId is required." }, { status: 400 });
  }

  try {
    const job = await createRegimeDiscoveryAnalysisJob(runId);
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Analysis job could not be created.",
      },
      { status: 400 },
    );
  }
}
