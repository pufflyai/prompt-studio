import type { ReadResult, StateInfo, StoredUpdate } from "pstdio-sync-contracts";
import { runBinaryTask } from "../binary-background";
import type { BinaryTaskResult } from "../binary-task-types";
import { decodeBytes } from "../encoding";
import { openUpdate, sealState, sealUpdate } from "../encryption";
import { downloadDocumentBlobs, prepareDocumentBlobManifest, uploadDocumentBlobs } from "./document-blobs";
import { createLocalDocumentComparison } from "./document-local";
import { loadDocumentState } from "./document-state";
import { type DocumentSyncInput, DocumentUpdateTooLarge, type SyncFailure } from "./document-sync-types";

export const latestStateLimits = { bytes: 1_048_576, updates: 1_000 };
const emptyReplica = () =>
  ({
    state: new Uint8Array([0, 0]),
    summary: new Uint8Array([0]),
    blobs: [],
    update: null,
    rejected: [],
  }) satisfies BinaryTaskResult;

export const createDocumentSync = (input: DocumentSyncInput) => {
  const { owner, store, space, documentId, relay } = input;
  const limits = input.limits ?? latestStateLimits;
  const abort = new AbortController();
  const local = createLocalDocumentComparison(store, owner, abort.signal);
  let remote: BinaryTaskResult = emptyReplica();
  let remoteRevision = 0;
  let pending: Uint8Array[] = [];
  let pendingEnvelopes: SyncFailure[] = [];
  let stateId: string | null = null;
  let through = 0;
  let after = 0;
  let bytes = 0;
  let updates = 0;
  let incomplete = false;
  let downloaded = false;
  let closed = false;
  let running: Promise<void> | undefined;
  const rejected = new Set<string>();
  const requireOpen = () => {
    if (closed) throw new Error("Document sync is closed");
  };
  const quarantine = async (failure: SyncFailure) => {
    incomplete = true;
    if (rejected.has(failure.id)) return;
    await input.quarantine(failure);
    rejected.add(failure.id);
  };
  const loadState = async (state: StateInfo) => {
    downloaded = false;
    const result = await loadDocumentState(input, state, abort.signal);
    const next = result.replica ?? emptyReplica();
    if (result.replica) incomplete = false;
    else await quarantine(result.source);
    requireOpen();
    remote = next;
    remoteRevision++;
    pending.push(next.state);
    pendingEnvelopes.push(result.source);
    stateId = state.stateId;
    through = state.through;
    after = through;
    bytes = 0;
    updates = 0;
  };
  const openUpdates = async (batch: StoredUpdate[]) => {
    const opened: { envelope: StoredUpdate; update: Uint8Array }[] = [];
    let cursor = after;
    for (const envelope of batch) {
      if (envelope.sequence !== cursor + 1) throw new Error("Relay update sequence has a gap");
      cursor = envelope.sequence;
      try {
        opened.push({ envelope, update: await openUpdate(space, documentId, envelope) });
      } catch {
        await quarantine({ kind: "update", id: envelope.updateId, envelope });
      }
    }
    return { opened, cursor };
  };
  const stageUpdates = async (batch: StoredUpdate[]) => {
    downloaded = false;
    const { opened, cursor } = await openUpdates(batch);
    if (!opened.length) {
      after = cursor;
      return;
    }
    const next = await runBinaryTask(
      {
        kind: "stage",
        base: remote.state,
        updates: opened.map(({ update }) => update),
      },
      abort.signal,
    );
    for (const index of next.rejected) {
      const envelope = opened[index].envelope;
      await quarantine({ kind: "update", id: envelope.updateId, envelope });
    }
    requireOpen();
    remote = next;
    remoteRevision++;
    if (next.update) pending.push(next.update);
    const accepted = opened.filter((_, index) => !next.rejected.includes(index));
    pendingEnvelopes.push(
      ...accepted.map(({ envelope }) => ({ kind: "update" as const, id: envelope.updateId, envelope })),
    );
    bytes += accepted.reduce((size, { envelope }) => size + decodeBytes(envelope.payload).length, 0);
    updates += accepted.length;
    after = cursor;
  };
  const mergeLocal = async () => {
    if (!pending.length) return;
    const update =
      pending.length === 1
        ? pending[0]
        : (await runBinaryTask({ kind: "checkpoint", updates: pending }, abort.signal)).state;
    requireOpen();
    const accepted = await local.receive(update, (blobs) => downloadDocumentBlobs(input, blobs));
    if (!accepted) for (const envelope of pendingEnvelopes) await quarantine(envelope);
    // Keep the batch until durable acceptance succeeds, including blob verification.
    pending = [];
    pendingEnvelopes = [];
  };
  const readUpdates = async (result: ReadResult) => {
    if (result.status === "state-required") throw new Error("Relay is missing updates after its latest state");
    const unseen = result.updates.filter((update) => update.sequence > after);
    // Each owner yields after a bounded batch. Already queued owners run before its next batch.
    for (let index = 0; index < unseen.length; index += 16) {
      await stageUpdates(unseen.slice(index, index + 16));
      await mergeLocal();
    }
    if (result.more) return false;
    if (after < result.lastSequence) throw new Error("Relay did not return every update");
    return true;
  };
  const read = async () => {
    while (true) {
      requireOpen();
      await mergeLocal();
      const result = await relay.read(after);
      if (result.state && result.state.stateId !== stateId) {
        // The page used an old cursor; a concurrent replacement can be behind it.
        await loadState(result.state);
        continue;
      }
      if (await readUpdates(result)) return;
      await mergeLocal();
    }
  };
  const replace = async (document: BinaryTaskResult, blobIds: string[]) => {
    const covered = incomplete ? through : after;
    const state = await sealState(space, documentId, {
      baseStateId: stateId,
      through: covered,
      state: document.state,
      summary: document.summary,
      blobIds,
    });
    requireOpen();
    if (!(await relay.replace(state))) return false;
    remote = document;
    remoteRevision++;
    stateId = state.stateId;
    through = covered;
    if (!incomplete) {
      bytes = 0;
      updates = 0;
    }
    return true;
  };
  const sendUpdate = async (document: BinaryTaskResult, update: Uint8Array) => {
    const blobIds = await uploadDocumentBlobs(input, document.blobs);
    requireOpen();
    try {
      await relay.update(await sealUpdate(space, documentId, update, blobIds));
    } catch (error) {
      if (!(error instanceof DocumentUpdateTooLarge)) throw error;
      await replace(document, blobIds);
    }
  };
  const synchronize = async () => {
    while (true) {
      await read();
      await mergeLocal();
      const document = await local.compare(remote.state, remoteRevision);
      if (document.complete === false) {
        downloaded = false;
        return;
      }
      if (await prepareDocumentBlobManifest(input, document.blobs)) continue;
      if (document.update) {
        await sendUpdate(document, document.update);
        // Another device may have written immediately before our receipt.
        continue;
      }
      if (!incomplete && after > through && (bytes > limits.bytes || updates > limits.updates)) {
        const blobIds = await uploadDocumentBlobs(input, remote.blobs);
        if (!(await replace(remote, blobIds))) continue;
      }
      downloaded = !incomplete;
      return;
    }
  };
  return {
    synchronize() {
      requireOpen();
      running ??= synchronize().finally(() => {
        running = undefined;
      });
      return running;
    },
    async status() {
      requireOpen();
      const document = await local.compare(remote.state, remoteRevision);
      return { downloaded, pending: !!document.update, needsAttention: incomplete };
    },
    close() {
      closed = true;
      abort.abort(new Error("Document sync is closed"));
      pending = [];
      pendingEnvelopes = [];
    },
  };
};
