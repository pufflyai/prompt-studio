import { waitForControllerPoll } from "./connection";
import { rememberEnvironmentCleanup } from "./environment-cleanup";
import { releaseEnvironment } from "./environments";
import { notifyRunChange } from "./events";
import { UnknownRunError } from "./run-store";
import type { RunCollectionDeps, RunRecord, RunSummary } from "./runs";

type ResultDeps = Pick<RunCollectionDeps, "store" | "changed" | "readSavedLog">;

export async function prepareResultStorage<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  while (true) {
    signal?.throwIfAborted();
    try {
      return await operation();
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof TypeError || error instanceof SyntaxError || error instanceof UnknownRunError) throw error;
      // No marker is durable yet: retain ownership and retry only local storage.
      await waitForControllerPoll(signal);
    }
  }
}

async function checkpointSummary(deps: ResultDeps, record: RunRecord, known?: RunSummary) {
  const metadata = record.pendingResult!.summary;
  if (known) return { ...metadata, tail: known.tail };
  if (!metadata.logPath) return { ...metadata, tail: "" };
  if (!deps.readSavedLog) throw new Error("The saved test log is unavailable for result recovery.");
  const tail = (await deps.readSavedLog(record.runId)).split("\n").slice(-60).join("\n");
  return { ...metadata, tail };
}

// The checkpoint remains discoverable through summary persistence, owner release
// and final marker removal, even when automation labels a local write failure permanent.
export async function finishPendingResult(
  deps: ResultDeps,
  record: RunRecord,
  known?: RunSummary,
): Promise<RunSummary> {
  const recordId = deps.store.records.id(`run:${record.runId}`);
  while (true) {
    const current = await deps.store.records.read(recordId);
    const value = current.value as unknown as RunRecord;
    const pending = value?.pendingResult;
    if (!pending) {
      if (value?.summary) return value.summary;
      throw new Error("The pending remote test result is unavailable.");
    }
    if (!value.summary) {
      const summary = await checkpointSummary(deps, value, known);
      const saved = await deps.store.records.commitIfCurrent({
        operationId: crypto.randomUUID(),
        edits: [{ recordId, expectedRevision: current.revision, set: { "/summary": summary } }],
      });
      if (!saved) continue;
    }
    // A rejection checkpoint owns the summary-to-cleanup crash interval. Keep it
    // indexed until shutdown ownership is durable or the kept claim is released.
    if (pending.cleanup?.stop)
      await rememberEnvironmentCleanup(deps.store, {
        environmentId: value.environmentId,
        runId: value.runId,
        stop: true,
      });
    if (pending.release) await releaseEnvironment(deps.store, value.environmentId, value.runId);
    const latest = await deps.store.records.read(recordId);
    const latestValue = latest.value as unknown as RunRecord;
    if (latestValue?.pendingResult?.id !== pending.id) continue;
    const cleared = await deps.store.records.commitIfCurrent({
      operationId: crypto.randomUUID(),
      edits: [{ recordId, expectedRevision: latest.revision, unset: ["/pendingResult"] }],
    });
    if (!cleared) continue;
    await notifyRunChange(deps);
    return latestValue.summary!;
  }
}

export async function persistResult(
  deps: ResultDeps,
  record: RunRecord,
  summary: RunSummary,
  release: boolean,
  signal?: AbortSignal,
  cleanup?: { stop: boolean },
) {
  const recordId = deps.store.records.id(`run:${record.runId}`);
  const { tail: _tail, ...metadata } = summary;
  const pendingResult = { id: crypto.randomUUID(), summary: metadata, release, ...(cleanup ? { cleanup } : {}) };
  // Definitive rejection has no remote receipt. Save its visible outcome and
  // unfinished handoff atomically, so neither restart nor queue/storage failure
  // can strand a terminal record behind a permanent claim.
  const rejection = cleanup ? { summary } : {};
  while (true) {
    signal?.throwIfAborted();
    const current = await prepareResultStorage(() => deps.store.records.read(recordId), signal);
    const value = current.value as unknown as RunRecord;
    if (current.deleted) throw new Error("The remote test run was removed before its result could be saved.");
    if (value?.pendingResult) return finishPendingResult(deps, value);
    if (value?.summary) return value.summary;
    const saved = await prepareResultStorage(async () => {
      if (!current.exists) {
        await deps.store.set(`run:${record.runId}`, { ...record, pendingResult, ...rejection });
        return true;
      }
      return deps.store.records.commitIfCurrent({
        operationId: crypto.randomUUID(),
        edits: [
          {
            recordId,
            expectedRevision: current.revision,
            set: { "/pendingResult": pendingResult, ...(cleanup ? { "/summary": { ...summary } } : {}) },
          },
        ],
      });
    }, signal);
    if (saved) break;
  }
  return finishPendingResult(deps, record, summary);
}

export async function completedResult(deps: ResultDeps, record: RunRecord): Promise<RunSummary | null> {
  return record.pendingResult ? finishPendingResult(deps, record) : (record.summary ?? null);
}
