import { waitForControllerPoll } from "./connection";
import { releaseEnvironment } from "./environments";
import { notifyRunChange } from "./events";
import type { RunCollectionDeps, RunRecord, RunSummary } from "./runs";

type ResultDeps = Pick<RunCollectionDeps, "store" | "changed" | "readSavedLog">;

export async function prepareResultStorage<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  while (true) {
    signal?.throwIfAborted();
    try {
      return await operation();
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof TypeError || error instanceof SyntaxError) throw error;
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
) {
  const recordId = deps.store.records.id(`run:${record.runId}`);
  const { tail: _tail, ...metadata } = summary;
  const pendingResult = { id: crypto.randomUUID(), summary: metadata, release };
  while (true) {
    signal?.throwIfAborted();
    const current = await prepareResultStorage(() => deps.store.records.read(recordId), signal);
    const value = current.value as unknown as RunRecord;
    if (current.deleted) throw new Error("The remote test run was removed before its result could be saved.");
    if (value?.pendingResult) return finishPendingResult(deps, value);
    if (value?.summary) return value.summary;
    const saved = await prepareResultStorage(async () => {
      if (!current.exists) {
        await deps.store.set(`run:${record.runId}`, { ...record, pendingResult });
        return true;
      }
      return deps.store.records.commitIfCurrent({
        operationId: crypto.randomUUID(),
        edits: [
          {
            recordId,
            expectedRevision: current.revision,
            set: { "/pendingResult": pendingResult },
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
