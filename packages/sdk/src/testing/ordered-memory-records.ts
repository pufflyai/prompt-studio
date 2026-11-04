import {
  applyBoundedOrderedOperation,
  compileOrderedGroup,
  type DocumentSnapshot,
  type OrderedDecision,
  type OrderedOperation,
  type OrderedRecord,
  observeOrderedRecord,
  operationDependencies,
  orderedBody,
  orderedProjection,
  projectBoundedOrderedOperation,
  projectOrderedOperation,
} from "pstdio-sync/records";
import {
  assertStorageLimits,
  fingerprint,
  type Json,
  type StorageGroup,
  type StorageSaveOutcome,
  type StorageTextDeclaration,
} from "pstdio-sync-contracts";
import type { createMemoryAssets } from "./memory-assets";

export interface OrderedMemoryState {
  canonical: Map<string, OrderedRecord>;
  decisions: Map<string, OrderedDecision>;
  identities: Map<string, string>;
}

/** An in-memory journal. Only the shared production compiler/reducer decides record semantics. */
export const createOrderedMemoryRecords = (
  assets: ReturnType<typeof createMemoryAssets>,
  declarations: StorageTextDeclaration[] = [],
) => {
  let canonical = new Map<string, OrderedRecord>();
  let views = new Map<string, OrderedRecord>();
  let decisions = new Map<string, OrderedDecision>();
  const identities = new Map<string, string>();
  const pending = new Map<string, OrderedOperation>();
  const textFields = structuredClone(declarations);
  const rebuild = async () => {
    views = new Map(canonical);
    const suppressed = new Set<string>();
    for (const operation of pending.values()) {
      if ([...operationDependencies(operation).keys()].some((id) => suppressed.has(id))) {
        suppressed.add(operation.operationId);
        continue;
      }
      const records = await projectBoundedOrderedOperation(views, operation, decisions);
      if (!records.length) suppressed.add(operation.operationId);
      for (const record of records) views.set(record.recordId, record);
    }
  };
  const outcome = async (operationId: string): Promise<StorageSaveOutcome | undefined> => {
    if (!identities.has(operationId)) return undefined;
    const decision = decisions.get(operationId);
    let state: StorageSaveOutcome["state"] = "saved-locally";
    if (decision) state = decision.state === "accepted" ? "synced" : "refused";
    return {
      operationId,
      state,
      status: "saved-locally",
    };
  };
  const read = async (recordId: string) => {
    const record = views.get(recordId);
    if (record) return orderedProjection(record);
    return {
      recordId,
      exists: false,
      deleted: false,
      value: null,
      asset: null,
      shared: null,
      revision: await observeOrderedRecord(undefined),
    };
  };
  return {
    read,
    list: async (prefix = "") =>
      Promise.all(
        [...views.keys()]
          .filter((id) => id.startsWith(prefix))
          .sort()
          .map(read),
      ),
    outcome,
    commit: async (input: StorageGroup) => {
      const group = structuredClone(input);
      const identity = await fingerprint(group as unknown as Json);
      const previous = identities.get(group.operationId);
      if (previous !== undefined) {
        if (previous !== identity) throw new Error("Operation identity reused with changed payload");
        return (await outcome(group.operationId))!;
      }
      const operation = await compileOrderedGroup(group, views, textFields);
      await assets.verifyComplete(group.edits.flatMap((edit) => (edit.asset ? [edit.asset] : [])));
      assertStorageLimits(
        await Promise.all(projectOrderedOperation(views, operation, decisions).map(orderedProjection)),
      );
      pending.set(operation.operationId, operation);
      identities.set(operation.operationId, identity);
      await rebuild();
      return (await outcome(operation.operationId))!;
    },
    seed: (records: OrderedRecord[]) => {
      canonical = new Map(records.map((record) => [record.recordId, structuredClone(record)]));
      views = new Map(canonical);
    },
    snapshot: (): DocumentSnapshot =>
      new Map(
        [...views]
          .filter(([, record]) => !record.deleted)
          .map(([id, record]) => {
            const body = orderedBody(record);
            return [
              id,
              {
                ...(Object.hasOwn(record.value as object, "value") ? { value: structuredClone(body.value) } : {}),
                ...(body.asset ? { asset: structuredClone(body.asset) as Json } : {}),
                ...(body.shared ? { shared: structuredClone(body.shared) as Json } : {}),
              },
            ];
          }),
      ),
    exportState: (): OrderedMemoryState => structuredClone({ canonical, decisions, identities }),
    pending: () => structuredClone([...pending.values()]),
    install: async (state: OrderedMemoryState) => {
      ({ canonical, decisions } = structuredClone(state));
      for (const id of decisions.keys()) pending.delete(id);
      await rebuild();
    },
  };
};

/** A simulated relay orders each immutable group once, including exact dependency decisions. */
export const admitMemoryOperations = async (
  state: OrderedMemoryState,
  operations: OrderedOperation[],
  epoch: string,
) => {
  for (const operation of operations) {
    const result = await applyBoundedOrderedOperation(
      state.canonical,
      operation,
      epoch,
      state.decisions.get(operation.operationId),
      state.decisions,
    );
    state.decisions.set(operation.operationId, result.decision);
    for (const record of result.records) state.canonical.set(record.recordId, record);
  }
};
