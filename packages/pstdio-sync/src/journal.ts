import { canonicalJson, type Receipt, type Scope, type Snapshot, sealMutation } from "pstdio-sync-contracts";
import { orderOperations } from "./graph";
import type { GroupedState, JournalEntry, LocalOperation } from "./types";

export const completedOperations = (snapshot: Snapshot | null) => {
  const completed = new Set<string>();
  for (const receipt of Object.values(snapshot?.receipts ?? {})) {
    if (receipt.status !== "accepted") continue;
    completed.add(receipt.operationId);
    for (const captured of receipt.mutation.resolution?.capturedOperationIds ?? []) completed.add(captured);
  }
  return completed;
};

export const retainAcceptance = (entry: JournalEntry, receipt: Receipt) => {
  if (receipt.recoveryProof) entry.recoveryProof = receipt.recoveryProof;
  if (receipt.status !== "accepted" || !receipt.checkpoint) return;
  const next = { fingerprint: receipt.fingerprint, order: receipt.order, checkpoint: receipt.checkpoint };
  const previous = entry.acceptance;
  if (
    previous?.fingerprint === next.fingerprint &&
    previous.order === next.order &&
    previous.checkpoint.epoch === next.checkpoint.epoch &&
    previous.checkpoint.sequence === next.checkpoint.sequence
  )
    return;
  entry.acceptance = next;
};

export const checkScope = (state: GroupedState, scope: Scope) => {
  if (scope.workbenchId !== state.owner.workbenchId || scope.extensionId !== state.owner.extensionId)
    throw new Error("Relay scope belongs to another storage owner");
  if (state.accepted && canonicalJson(state.accepted.scope) !== canonicalJson(scope))
    throw new Error("Storage is already bound to another account");
};

export const sealOperation = async (state: GroupedState, operation: LocalOperation) => {
  if (!state.accepted) throw new Error("Storage has not received a relay snapshot");
  if (!operation.position) {
    const sequence =
      Math.max(
        state.accepted.writers[operation.environmentId]?.floor ?? 0,
        ...state.journal
          .filter((entry) => entry.mutation.environmentId === operation.environmentId)
          .map((entry) => entry.mutation.position?.sequence ?? 0),
      ) + 1;
    operation.position = { epoch: state.accepted.checkpoint.epoch, generation: state.accepted.generation, sequence };
  }
  const { position, ...body } = operation;
  return sealMutation({ ...body, ...position, protocolVersion: 2, scope: state.accepted.scope });
};

const snapshotVersion = (snapshot: Snapshot | null) => snapshot && canonicalJson(snapshot);

export const receiveSnapshot = async (state: GroupedState, snapshot: Snapshot, observed: Snapshot | null) => {
  checkScope(state, snapshot.scope);
  // A response cannot replace state advanced by another sync while it was in flight.
  // Epochs are opaque, so compare the request's observed version across restores.
  if (snapshotVersion(state.accepted) !== snapshotVersion(observed)) return;
  if (
    state.accepted?.checkpoint.epoch === snapshot.checkpoint.epoch &&
    (snapshot.journalSequence < state.accepted.journalSequence ||
      snapshot.checkpoint.sequence < state.accepted.checkpoint.sequence)
  )
    return;
  for (const receipt of Object.values(snapshot.receipts)) {
    let entry = state.journal.find((entry) => entry.mutation.operationId === receipt.operationId);
    if (entry) {
      const sealed = await sealOperation({ ...state, accepted: snapshot }, entry.mutation);
      if (sealed.fingerprint !== receipt.fingerprint)
        throw new Error("Received operation identity has changed content");
    } else {
      const { operationId, environmentId, parents, changes, resolution, document, epoch, generation, sequence } =
        receipt.mutation;
      entry = {
        inputFingerprint: receipt.fingerprint,
        mutation: {
          operationId,
          environmentId,
          parents,
          changes,
          resolution,
          document,
          position: { epoch, generation, sequence },
        },
      };
      state.journal.push(entry);
    }
    retainAcceptance(entry, receipt);
  }
  state.accepted = snapshot;
};

export const pendingOperations = (state: GroupedState, environmentId: string) => {
  const completed = completedOperations(state.accepted);
  const entries = new Map(state.journal.map((entry) => [entry.mutation.operationId, entry]));
  const recovery = new Set<string>();
  const visit = (id: string) => {
    if (completed.has(id) || recovery.has(id)) return;
    const entry = entries.get(id);
    if (!entry) throw new Error("Journal dependency is unavailable");
    recovery.add(id);
    for (const parent of entry.mutation.parents) visit(parent);
  };
  for (const entry of state.journal)
    if (entry.acceptance && !completed.has(entry.mutation.operationId)) visit(entry.mutation.operationId);
  const ordered = orderOperations(new Map([...entries].map(([id, entry]) => [id, entry.mutation])), recovery);
  for (const entry of state.journal) {
    const mutation = entry.mutation;
    if (
      mutation.environmentId === environmentId &&
      !completed.has(mutation.operationId) &&
      !recovery.has(mutation.operationId)
    )
      ordered.push(mutation);
  }
  return ordered;
};
