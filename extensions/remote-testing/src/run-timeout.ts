import { rememberEnvironmentCleanup } from "./environment-cleanup";
import { ownsEnvironment } from "./environments";
import { persistResult, prepareResultStorage } from "./result-persistence";
import { rememberRunLog } from "./run-log";
import type { RunCollectionDeps, RunRecord, RunSummary } from "./runs";

export async function saveTimedOutRun(
  deps: RunCollectionDeps,
  record: RunRecord,
  summary: RunSummary,
  finalized: boolean,
  stop: boolean,
  signal?: AbortSignal,
) {
  // Independent cleanup and log workers own remote retries. A network outage must
  // not keep an overdue result looking like an active test run.
  await prepareResultStorage(async () => {
    if (stop && (await ownsEnvironment(deps.store, record.environmentId, record.runId)))
      await rememberEnvironmentCleanup(
        deps.store,
        {
          environmentId: record.environmentId,
          runId: record.runId,
          stop: true,
        },
        true,
      );
    await rememberRunLog(deps.store, record.runId, !finalized);
  }, signal);
  summary = await persistResult(deps, record, summary, finalized && !stop, signal);
  await Promise.allSettled([
    ...(stop
      ? [
          Promise.resolve().then(() =>
            deps.cleanupEnvironment?.({
              environmentId: record.environmentId,
              runId: record.runId,
              stop: true,
            }),
          ),
        ]
      : []),
    Promise.resolve().then(() => deps.collectRunLog?.(record.runId)),
  ]);
  return summary;
}
