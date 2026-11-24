import { completedResult, prepareResultStorage } from "./result-persistence";
import { readRunReceipt, runDeadline } from "./run-deadline";
import type { Receipt } from "./run-result";
import type { RunCollectionDeps, RunRecord } from "./runs";
import { readRunSetup, recoverRunSetup } from "./setup-claims";

export async function readCollectionState(
  deps: RunCollectionDeps,
  record: RunRecord,
  signal?: AbortSignal,
  retryTransient = false,
) {
  const readState = async () => {
    await recoverRunSetup(deps.store, record.environmentId, record.runId);
    const setup = await readRunSetup(deps.store, record);
    // Read saved admission metadata last on every retry, after setup/owner reads.
    const latest = (await deps.store.get<RunRecord>(`run:${record.runId}`)) ?? record;
    return { record: latest, setup };
  };
  const state = await (retryTransient ? prepareResultStorage(readState, signal) : readState());
  record = state.record;
  // Completion may release ownership and is recovered through its durable marker,
  // not replayed by the pre-checkpoint storage retry boundary.
  const summary = await completedResult(deps, record);
  let setup = state.setup;
  if (summary && setup) {
    const readSetup = () => readRunSetup(deps.store, record);
    setup = await (retryTransient ? prepareResultStorage(readSetup, signal) : readSetup());
  }
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
  let state = await readCollectionState(deps, record, signal, retryTransient);
  record = state.record;
  if (!state.summary && !state.setup && !receipt?.finalizedAt && !finalRead && Date.now() >= runDeadline(record)) {
    receipt = await readReceipt();
    state = await readCollectionState(deps, record, signal, retryTransient);
  }
  return { ...state, receipt, missingSubmission, finalRead };
}
