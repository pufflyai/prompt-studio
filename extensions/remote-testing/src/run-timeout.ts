import { rememberEnvironmentCleanup } from "./environment-cleanup";
import { ownsEnvironment, releaseEnvironment } from "./environments";
import { notifyRunChange } from "./events";
import { rememberRunLog } from "./run-log";
import type { RunCollectionDeps, RunRecord, RunSummary } from "./runs";

export async function saveTimedOutRun(
  deps: RunCollectionDeps,
  record: RunRecord,
  summary: RunSummary,
  finalized: boolean,
  stop: boolean,
) {
  // Independent cleanup and log workers own remote retries. A network outage must
  // not keep an overdue result looking like an active test run.
  if (stop && (await ownsEnvironment(deps.store, record.environmentId, record.runId)))
    await rememberEnvironmentCleanup(deps.store, {
      environmentId: record.environmentId,
      runId: record.runId,
      stop: true,
    });
  await rememberRunLog(deps.store, record.runId, !finalized);
  if (finalized && !stop) await releaseEnvironment(deps.store, record.environmentId, record.runId);
  await deps.store.set(`run:${record.runId}`, { ...record, summary });
  await notifyRunChange(deps);
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
