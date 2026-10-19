import type { Receipt } from "pstdio-sync-contracts";
import {
  canonicalJson,
  negotiate,
  protocolPeer,
  receiptSchema,
  snapshotFingerprint,
  snapshotSchema,
  validateMutation,
} from "pstdio-sync-contracts";
import { downloadSnapshotAssets, uploadMutationAssets } from "./asset-transfer";
import { checkScope, pendingOperations, receiveSnapshot, retainAcceptance, sealOperation } from "./journal";
import type { AssetStore, GroupedStore, RelayAdapter, StorageOwner } from "./types";

export const synchronize = async (
  input: {
    store: GroupedStore;
    owner: StorageOwner;
    environmentId: string;
    assets?: AssetStore;
  },
  adapter: RelayAdapter,
) => {
  const compatibility = negotiate(protocolPeer, adapter.peer ?? protocolPeer);
  if (compatibility.status !== "compatible") return { ...compatibility, outcomes: [] };
  await input.store.transaction(input.owner, async (state) => checkScope(state, adapter.scope));
  const receive = async () => {
    const observed = await input.store.transaction(input.owner, async (state) => state.accepted);
    const snapshot = snapshotSchema.parse(await adapter.snapshot());
    if (
      observed &&
      (observed.checkpoint.epoch !== snapshot.checkpoint.epoch || observed.generation !== snapshot.generation)
    )
      throw new Error("Resynchronization required: preserve local records, proposals and source bytes");
    if (canonicalJson(snapshot.scope) !== canonicalJson(adapter.scope))
      throw new Error("Relay snapshot scope differs from its adapter");
    for (const receipt of Object.values(snapshot.receipts)) await validateMutation(receipt.mutation);
    await downloadSnapshotAssets(input.assets, adapter, snapshot);
    await input.store.transaction(input.owner, (state) => receiveSnapshot(state, snapshot, observed));
  };
  await receive();
  const pending = await input.store.transaction(input.owner, async (state) =>
    Promise.all(
      pendingOperations(state, input.environmentId).map(async (operation) => ({
        mutation: await sealOperation(state, operation),
        proof: state.journal.find((entry) => entry.mutation.operationId === operation.operationId)?.recoveryProof,
      })),
    ),
  );
  const outcomes: Receipt[] = [];
  for (const { mutation, proof } of pending) {
    await uploadMutationAssets(input.assets, adapter, mutation);
    const foreignRecovery = mutation.environmentId !== input.environmentId && adapter.recover;
    if (foreignRecovery && !proof) throw new Error("Relay recovery proof is unavailable for a retained operation");
    const receipt = receiptSchema.parse(
      foreignRecovery ? await foreignRecovery(mutation, proof!) : await adapter.submit(mutation),
    );
    await validateMutation(receipt.mutation);
    if (receipt.operationId !== mutation.operationId || receipt.fingerprint !== mutation.fingerprint)
      throw new Error("Relay receipt differs from the submitted operation");
    await input.store.transaction(input.owner, async (state) => {
      const entry = state.journal.find((entry) => entry.mutation.operationId === mutation.operationId)!;
      retainAcceptance(entry, receipt);
    });
    outcomes.push(receipt);
  }
  await receive();
  const installed = await input.store.transaction(input.owner, async (state) => ({
    snapshot: state.accepted!,
    branches: pendingOperations(state, input.environmentId).map((operation) => operation.operationId),
  }));
  if (
    adapter.acknowledge &&
    Object.hasOwn(installed.snapshot.writers, input.environmentId) &&
    installed.branches.every((id) => Object.hasOwn(installed.snapshot.receipts, id))
  )
    await adapter.acknowledge({
      protocolVersion: 2,
      scope: adapter.scope,
      epoch: installed.snapshot.checkpoint.epoch,
      generation: installed.snapshot.generation,
      environmentId: input.environmentId,
      cut: installed.snapshot.checkpoint.sequence,
      snapshotHash: await snapshotFingerprint(installed.snapshot),
      branches: installed.branches,
      recovery: [],
    });
  return input.store.transaction(input.owner, async (state) => {
    const conflicts = Object.values(state.accepted?.conflicts ?? {}).some((conflict) => !conflict.resolvedBy);
    if (conflicts) return { status: "conflict" as const, outcomes };
    if (pendingOperations(state, input.environmentId).length) return { status: "pending" as const, outcomes };
    return { status: "synchronized" as const, outcomes };
  });
};
