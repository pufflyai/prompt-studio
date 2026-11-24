import type { RunDeps, RunRecord, RunSummary } from "./runs";

export async function saveSubmissionFailure(deps: RunDeps, record: RunRecord | undefined, error: unknown) {
  if (!record) return;
  const summary: RunSummary = {
    runId: record.runId,
    environmentId: record.environmentId,
    status: "error",
    exitCode: null,
    durationMs: Math.max(0, Date.now() - Date.parse(record.startedAt)),
    logPath: null,
    tail: "",
    error: error instanceof Error ? error.message : String(error),
  };
  const recordId = deps.store.records.id(`run:${record.runId}`);
  while (true) {
    const current = await deps.store.records.read(recordId);
    if (!current.exists || current.deleted || (current.value as unknown as RunRecord)?.summary) return;
    if (
      await deps.store.records.commitIfCurrent({
        operationId: crypto.randomUUID(),
        edits: [{ recordId, expectedRevision: current.revision, set: { "/summary": { ...summary } } }],
      })
    )
      return;
  }
}
