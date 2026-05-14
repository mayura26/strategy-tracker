import { auth } from "@/auth";
import { getAnalysisJob } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const job = await getAnalysisJob(id);

  if (!job) {
    return Response.json({ error: "Analysis job not found." }, { status: 404 });
  }

  return Response.json({ job });
}
