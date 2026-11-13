import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import {
  CANDIDATE_LIMIT,
  getReleaseRun,
  listReleaseJobs,
  listReleaseRuns,
  RELEASE_WORKFLOW,
  releaseSelection,
  WORKFLOW_RUN_LIMIT,
} from "./github";
import { readHealth } from "./history";
import { readHealthSync } from "./sync-state";

export const inspectRelease = async (
  ctx: Pick<ExtensionContextBase, "process" | "extensionFiles" | "automation">,
  runId?: string,
) => {
  const run = runId ? await getReleaseRun(ctx, runId) : (await listReleaseRuns(ctx))[0];
  if (!run) throw new Error("No release workflow runs are available on GitHub.");
  const live = await listReleaseJobs(ctx, run).then(
    (jobs) => ({ jobs, error: undefined }),
    (error: unknown) => ({ jobs: null, error: error instanceof Error ? error.message : String(error) }),
  );
  const history = await readHealth(ctx);
  return {
    run,
    selection: live.jobs ? releaseSelection(run, live.jobs) : null,
    window: { workflow: RELEASE_WORKFLOW, workflowRunLimit: WORKFLOW_RUN_LIMIT, candidateLimit: CANDIDATE_LIMIT },
    cached: history.runs.find((entry) => entry.id === run.id) ?? null,
    syncedAt: history.syncedAt,
    error: live.error ?? history.error,
    sync: await readHealthSync(ctx),
    jobs: live.jobs,
  };
};
