import type { StateInfo } from "pstdio-sync-contracts";
import { runBinaryTask } from "../binary-background";
import { InvalidBinaryTask } from "../binary-task-types";
import { encodeBytes } from "../encoding";
import { openState, openSummary } from "../encryption";
import type { DocumentSyncInput, SyncFailure } from "./document-sync-types";

export const loadDocumentState = async (input: DocumentSyncInput, state: StateInfo, signal: AbortSignal) => {
  const payload = await input.relay.state(state);
  const source: SyncFailure = {
    kind: "state",
    id: state.stateId,
    envelope: { ...state, payload: encodeBytes(payload) },
  };
  let opened: { state: Uint8Array; summary: Uint8Array };
  try {
    opened = {
      state: await openState(input.space, input.documentId, state, payload),
      summary: await openSummary(input.space, input.documentId, state),
    };
  } catch {
    signal.throwIfAborted();
    return { replica: null, source };
  }
  try {
    const replica = await runBinaryTask(
      { kind: "stage", base: opened.state, summary: opened.summary, updates: [] },
      signal,
    );
    return { replica, source };
  } catch (error) {
    // Worker startup/exit and database errors must retry, not quarantine healthy data.
    if (!(error instanceof InvalidBinaryTask)) throw error;
    return { replica: null, source };
  }
};
