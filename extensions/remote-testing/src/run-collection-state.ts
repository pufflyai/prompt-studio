import { completedResult } from "./result-persistence";
import { readRunReceipt, runDeadline } from "./run-deadline";
import type { Receipt } from "./run-result";
import type { RunCollectionDeps, RunRecord } from "./runs";
import { readRunSetup, recoverRunSetup } from "./setup-claims";

export async function readCollectionState(deps: RunCollectionDeps, record: RunRecord) {
  await recoverRunSetup(deps.store, record.environmentId, record.runId);
  record = (await deps.store.get<RunRecord>(`run:${record.runId}`)) ?? record;
  const summary = await completedResult(deps, record);
  const setup = await readRunSetup(deps.store, record);
  if (summary && setup)
    await Promise.allSettled([
      Promise.resolve().then(() =>
        deps.cleanupEnvironment?.({ environmentId: record.environmentId, runId: record.runId, stop: setup.stop }),
      ),
    ]);
  return { record, summary, setup };
}

export async function readCollectionReceipt(
  deps: RunCollectionDeps,
  record: RunRecord,
  signal?: AbortSignal,
  retryTransient = false,
) {
  let missingSubmission = false;
  let finalRead = false;
  const readReceipt = () => {
    missingSubmission = false;
    return readRunReceipt<Receipt>(
      deps.api,
      `/v1/workspaces/${record.environmentId}/requests/${record.requestId}?conversationId=${record.conversationId}`,
      record,
      signal,
      retryTransient,
      () => {
        missingSubmission = true;
      },
      () => {
        finalRead = true;
      },
    );
  };
  let receipt = await readReceipt();
  // Admission and setup may change during receipt I/O or this local reload.
  let state = await readCollectionState(deps, record);
  record = state.record;
  if (!state.summary && !state.setup && !receipt?.finalizedAt && !finalRead && Date.now() >= runDeadline(record)) {
    receipt = await readReceipt();
    state = await readCollectionState(deps, record);
  }
  return { ...state, receipt, missingSubmission, finalRead };
}
