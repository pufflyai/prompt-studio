import type { ReadResult, StateInfo, StoredUpdate } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { decodeBytes, encodeBytes } from "../encoding";
import { openState, openSummary, openUpdate, sealState, sealUpdate } from "../encryption";
import {
  downloadDocumentBlobs,
  prepareDocumentBlobs,
  uploadDocumentBlobs,
  validateDocumentBlobs,
} from "./document-blobs";
import { checkSummary, cloneDocument, missingUpdate } from "./document-merge";
import { type DocumentSyncInput, DocumentUpdateTooLarge, type SyncFailure } from "./document-sync-types";

export const latestStateLimits = { bytes: 1_048_576, updates: 1_000 };

export const createDocumentSync = (input: DocumentSyncInput) => {
  const { owner, store, space, documentId, relay } = input;
  const limits = input.limits ?? latestStateLimits;
  let remote = new Y.Doc();
  let stateId: string | null = null;
  let through = 0;
  let after = 0;
  let bytes = 0;
  let updates = 0;
  let incomplete = false;
  let downloaded = false;
  const rejected = new Set<string>();
  const quarantine = async (failure: SyncFailure) => {
    incomplete = true;
    if (rejected.has(failure.id)) return;
    await input.quarantine(failure);
    rejected.add(failure.id);
  };
  const loadState = async (state: StateInfo) => {
    downloaded = false;
    let next = new Y.Doc();
    const payload = await relay.state(state);
    try {
      Y.applyUpdate(next, await openState(space, documentId, state, payload));
      checkSummary(next, await openSummary(space, documentId, state));
      validateDocumentBlobs(next);
      incomplete = false;
    } catch {
      next.destroy();
      next = new Y.Doc();
      await quarantine({ kind: "state", id: state.stateId, envelope: { ...state, payload: encodeBytes(payload) } });
    }
    remote.destroy();
    remote = next;
    stateId = state.stateId;
    through = state.through;
    after = through;
    bytes = 0;
    updates = 0;
  };
  const applyUpdate = async (update: StoredUpdate) => {
    downloaded = false;
    const next = cloneDocument(remote);
    try {
      Y.applyUpdate(next, await openUpdate(space, documentId, update));
      validateDocumentBlobs(next);
    } catch {
      next.destroy();
      await quarantine({ kind: "update", id: update.updateId, envelope: update });
      after = update.sequence;
      return;
    }
    remote.destroy();
    remote = next;
    after = update.sequence;
    bytes += decodeBytes(update.payload).length;
    updates++;
  };
  const readUpdates = async (result: ReadResult) => {
    if (result.status === "state-required") throw new Error("Relay is missing updates after its latest state");
    for (const update of result.updates) {
      if (update.sequence <= after) continue;
      if (update.sequence !== after + 1) throw new Error("Relay update sequence has a gap");
      await applyUpdate(update);
    }
    if (result.more) return false;
    if (after < result.lastSequence) throw new Error("Relay did not return every update");
    return true;
  };
  const read = async () => {
    while (true) {
      const result = await relay.read(after);
      if (result.state && result.state.stateId !== stateId) {
        // This page used the old cursor. A concurrent state can be behind it; start at its boundary.
        await loadState(result.state);
        continue;
      }
      if (await readUpdates(result)) return;
      // A later page may introduce an incomplete state ahead of this cursor. Keep the edits we
      // already received in the local owner before replacing the relay replica with that state.
      const local = await mergeLocal();
      local.destroy();
    }
  };
  const mergeLocal = async () => {
    await downloadDocumentBlobs(input, remote);
    return store.transaction(owner, async ({ document }) => {
      Y.applyUpdate(document, Y.encodeStateAsUpdate(remote));
      return cloneDocument(document);
    });
  };
  const replace = async (document: Y.Doc, blobIds: string[]) => {
    // A large local diff uses the state channel too. Keep rejected updates in the tail rather than
    // claiming to cover them, so publishing healthy local data never deletes unreadable envelopes.
    const covered = incomplete ? through : after;
    const state = await sealState(space, documentId, {
      baseStateId: stateId,
      through: covered,
      state: Y.encodeStateAsUpdate(document),
      summary: Y.encodeStateVector(document),
      blobIds,
    });
    if (!(await relay.replace(state))) return false;
    const next = cloneDocument(document);
    remote.destroy();
    remote = next;
    stateId = state.stateId;
    through = covered;
    if (!incomplete) {
      bytes = 0;
      updates = 0;
    }
    return true;
  };
  const sendUpdate = async (local: Y.Doc, update: Uint8Array) => {
    const blobIds = await uploadDocumentBlobs(input, local);
    try {
      await relay.update(await sealUpdate(space, documentId, update, blobIds));
    } catch (error) {
      if (!(error instanceof DocumentUpdateTooLarge)) throw error;
      await replace(local, blobIds);
    }
  };
  return {
    async synchronize() {
      while (true) {
        await read();
        const local = await mergeLocal();
        try {
          await prepareDocumentBlobs(input, local);
          const update = missingUpdate(local, remote);
          if (update) {
            await sendUpdate(local, update);
            // Do not jump to our receipt's sequence: another device may have written just before it.
            continue;
          }
          if (!incomplete && after > through && (bytes > limits.bytes || updates > limits.updates)) {
            const blobIds = await uploadDocumentBlobs(input, remote);
            if (!(await replace(remote, blobIds))) continue;
          }
          downloaded = !incomplete;
          return;
        } finally {
          local.destroy();
        }
      }
    },
    // Compare against the relay replica, including delete-only edits. A durable local
    // transaction after synchronization must immediately stop reporting synced.
    status: () =>
      store.transaction(owner, async ({ document }) => ({
        downloaded,
        pending: !!missingUpdate(document, remote),
        needsAttention: incomplete,
      })),
    close: () => remote.destroy(),
  };
};
