import {
  applyBoundedOrderedOperation,
  compileOrderedGroup,
  type DocumentSnapshot,
  forwardDisplacedSave,
  type OrderedDecision,
  type OrderedMoveInput,
  type OrderedOperation,
  type OrderedRecord,
  observeOrderedRecord,
  operationDependencies,
  orderedBody,
  orderedProjection,
  planCatchUpMoves,
  prepareCatchUpMoves,
  prepareOrderedLocalAdoption,
  prepareOrderedMove,
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
  /** Records whose edits relay order skipped, by operation, so their author can forward them. */
  skipped?: Map<string, string[]>;
}

const verifyIdentities = (local: ReadonlyMap<string, string>, remote: ReadonlyMap<string, string>) => {
  for (const [id, identity] of remote) {
    const previous = local.get(id);
    if (previous !== undefined && previous !== identity)
      throw new Error("Operation identity reused with changed payload");
  }
};

/** An in-memory journal. Only the shared production compiler/reducer decides record semantics. */
export const createOrderedMemoryRecords = (
  assets: ReturnType<typeof createMemoryAssets>,
  declarations: StorageTextDeclaration[] = [],
  changed?: (recordIds?: readonly string[]) => void,
) => {
  let joined = false;
  const localEpoch = `local:${crypto.randomUUID()}`;
  const delivered = new Set<string>();
  let canonical = new Map<string, OrderedRecord>();
  let views = new Map<string, OrderedRecord>();
  let decisions = new Map<string, OrderedDecision>();
  const identities = new Map<string, string>();
  const pending = new Map<string, OrderedOperation>();
  const textFields = structuredClone(declarations);
  // Reducers replace changed records; unchanged objects keep their projection across queries.
  const projections = new WeakMap<OrderedRecord, ReturnType<typeof orderedProjection>>();
  let revisionToken = {};
  const rebuild = async () => {
    views = new Map(canonical);
    revisionToken = {};
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
    if (decision?.state === "refused") state = "refused";
    else if (decision && (!decision.epoch.startsWith("local:") || delivered.has(operationId))) state = "synced";
    return {
      operationId,
      state,
      status: "saved-locally",
    };
  };
  const read = async (recordId: string) => {
    const record = views.get(recordId);
    if (record) {
      let projection = projections.get(record);
      if (!projection) {
        projection = orderedProjection(record);
        projections.set(record, projection);
      }
      // Every caller owns its values, including the first reader of a cached projection.
      return structuredClone(await projection);
    }
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
  const queue = async (operation: OrderedOperation, identity: string) => {
    if (joined) pending.set(operation.operationId, operation);
    else {
      const result = await applyBoundedOrderedOperation(canonical, operation, localEpoch, undefined, decisions);
      decisions.set(operation.operationId, result.decision);
      for (const record of result.records) canonical.set(record.recordId, record);
    }
    identities.set(operation.operationId, identity);
    await rebuild();
    changed?.(operation.edits.map((edit) => edit.recordId));
  };
  // Like the database store: forward this device's refused saves that a move displaced, and move old
  // collection items still live although their collection moved. Skipped saves are not tracked here.
  // Decided saves of this device: refused ones, and ones whose edits relay order partly skipped.
  const settleMoves = async (
    decided: { operation: OrderedOperation; refused: boolean; skipped: Set<string> }[],
    changed: string[],
  ) => {
    const read = async (ids: string[]) =>
      new Map(ids.flatMap((id) => (canonical.has(id) ? [[id, canonical.get(id)!]] : [])));
    const current = async () => views;
    const list = async (prefix: string) =>
      [...views].filter(([id, record]) => id.startsWith(prefix) && !record.deleted).map(([id]) => id);
    const markers = async () =>
      [...canonical.values()].filter((record) => record.recordId.includes(',"collection-moved",'));
    const prepared = [];
    for (const save of decided) {
      const next = await forwardDisplacedSave({
        ...save,
        canonical: read,
        views: current,
        markers,
        refusedMove: async (operationId) => decisions.get(operationId)?.state === "refused",
      });
      if (next) prepared.push(next);
    }
    prepared.push(...(await prepareCatchUpMoves(await planCatchUpMoves({ changed, canonical: read, list }), current)));
    for (const next of prepared) {
      pending.set(next.operation.operationId, next.operation);
      identities.set(next.operation.operationId, next.identity);
    }
    if (prepared.length) await rebuild();
  };
  return {
    read,
    revisionToken: () => revisionToken,
    list: async (prefix = "") =>
      Promise.all(
        [...views]
          .filter(([id, record]) => id.startsWith(prefix) && !record.deleted)
          .map(([id]) => id)
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
      await queue(operation, identity);
      return (await outcome(operation.operationId))!;
    },
    /** Host-only: move live records to new IDs with their text history and native sources. */
    move: async (input: OrderedMoveInput) => {
      const { moved, remaining, operation, identity } = await prepareOrderedMove(views, input);
      if (operation) await queue(operation, identity!);
      return { moved, remaining };
    },
    seed: (records: OrderedRecord[]) => {
      canonical = new Map(records.map((record) => [record.recordId, structuredClone(record)]));
      views = new Map(canonical);
      revisionToken = {};
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
      verifyIdentities(identities, state.identities);
      const before = canonical;
      const local = joined ? [] : [...canonical.values()];
      const previous = decisions;
      ({ canonical, decisions } = structuredClone(state));
      for (const [id, decision] of previous) {
        const remote = decisions.get(id);
        if (remote?.fingerprint === decision.fingerprint && remote.epoch === decision.epoch) delivered.add(id);
        if (!remote) decisions.set(id, decision);
      }
      joined = true;
      for (const record of local) {
        const operation = await prepareOrderedLocalAdoption(record, canonical.get(record.recordId));
        if (operation) pending.set(operation.operationId, operation);
      }
      const decided = [...pending.values()].flatMap((operation) => {
        const refused = decisions.get(operation.operationId)?.state === "refused";
        const skipped = new Set(state.skipped?.get(operation.operationId) ?? []);
        return refused || skipped.size ? [{ operation, refused, skipped }] : [];
      });
      for (const id of decisions.keys()) pending.delete(id);
      await rebuild();
      const changed = [...new Set([...before.keys(), ...canonical.keys()])].filter(
        (id) => JSON.stringify(before.get(id)) !== JSON.stringify(canonical.get(id)),
      );
      await settleMoves(decided, changed);
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
    if (result.skipped.length) {
      state.skipped ??= new Map();
      state.skipped.set(
        operation.operationId,
        result.skipped.map((skip) => skip.recordId),
      );
    }
    for (const record of result.records) state.canonical.set(record.recordId, record);
  }
};
