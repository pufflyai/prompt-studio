import type { StorageOwner } from "pstdio-sync";
import type { SyncSpace } from "pstdio-sync/encryption";
import { createOrderedReceiptIndex, type OrderedAdmission, type OrderedIndexReference } from "pstdio-sync/records";
import type { DocumentRelay, RecordFrame, RecordStreamCursor, RecordStreamStore } from "pstdio-sync/relay";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_ordered_records as canonical } from "../../db/schemas.pg";
import { indexOrderedCheckpoint, stageOrderedCheckpoint } from "./ordered-checkpoint";
import { type OrderedJournal, withOrderedOwner } from "./ordered-journal";
import { applyOrderedNativeAdmission } from "./ordered-native-apply";
import { applyOrderedNumberPolicy } from "./ordered-number-admission";
import { combineNumberEvents } from "./ordered-number-projection";
import { applyBoundedOrderedOperation } from "./ordered-policy";
import { initializeOrderedOwner } from "./ordered-projection";
import { admissionDecisions, rebaseOrderedProjection } from "./ordered-rebase";
import { adoptOrderedCheckpoint } from "./ordered-receipts-adoption";
import { createOrderedManifestCache } from "./ordered-receipts-blobs";
import { coverOrderedReceiptRoot } from "./ordered-receipts-covered";
import { createOrderedReceiptResolver } from "./ordered-receipts-resolver";
import { receiptRoots, sameReceiptRoot, saveReceiptRoots } from "./ordered-receipts-state";
import { nextOrderedUpload } from "./ordered-receipts-upload";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { applyOrderedStreamFrame } from "./ordered-stream-frames";
import { orderedCursor, readOrderedOwner, saveOrderedCursor } from "./ordered-stream-state";
import { createRecordStreamStore } from "./record-stream-store";
import type { NumberChange } from "./resource-number-repair";

export const createOrderedStreamStore = (
  db: DbClient,
  owner: StorageOwner,
  deps: Parameters<typeof createRecordStreamStore>[2],
) => {
  const references = createRecordStreamStore(db, owner, deps).references;
  let index: ReturnType<typeof createOrderedReceiptIndex> | undefined;
  let cache: ReturnType<typeof createOrderedManifestCache> | undefined;
  let connected: DocumentRelay | undefined;
  const receiptIndex = () => {
    if (!index) throw new Error("Ordered receipt transport has not connected");
    return index;
  };
  const run = <T>(action: (journal: OrderedJournal, tx: OrderedTransaction) => Promise<T>) =>
    withOrderedOwner(db, owner, async (journal, tx, created) => {
      await initializeOrderedOwner(journal, tx, owner, created);
      return cache ? cache.transaction(tx, () => action(journal, tx)) : action(journal, tx);
    });
  const notify = (events: NumberChange[] = []) => {
    deps.changed();
    deps.numbersChanged?.(combineNumberEvents(events));
  };
  const applyAdmission = async (
    journal: OrderedJournal,
    tx: OrderedTransaction,
    admission: OrderedAdmission,
    epoch: string,
    root?: OrderedIndexReference | null,
  ) => {
    if (admission.epoch !== epoch) throw new Error("A save belongs to another order epoch");
    const retained = root === undefined ? receiptRoots((await readOrderedOwner(tx, owner)).receipt_root).root : root;
    const resolver = createOrderedReceiptResolver(journal, retained, receiptIndex());
    const previous = await resolver.admission(admission);
    const operation = admission.operation;
    const before = await journal.canonical(operation.edits.map((edit) => edit.recordId));
    const applied = await applyBoundedOrderedOperation(
      before,
      operation,
      epoch,
      previous,
      await admissionDecisions(journal, admission),
    );
    const result = await applyOrderedNumberPolicy(tx, owner, operation, epoch, applied, !!previous);
    await journal.saveCanonical(result.records);
    await journal.recordDecision(result.decision, await fingerprint(admission as unknown as Json));
    return [
      ...new Set([...operation.edits.map((edit) => edit.recordId), ...result.records.map((record) => record.recordId)]),
    ];
  };
  const mergeIn = (
    journal: OrderedJournal,
    tx: OrderedTransaction,
    remote: Map<string, Uint8Array[]>,
    cursor: RecordStreamCursor,
  ) =>
    adoptOrderedCheckpoint({ journal, tx, owner, index: receiptIndex(), remote, cursor, applyAdmission, applyNative });
  const applyNative = (
    journal: OrderedJournal,
    tx: OrderedTransaction,
    admission: OrderedAdmission,
    epoch: string,
    root?: OrderedIndexReference | null,
  ) => applyOrderedNativeAdmission({ journal, tx, owner, admission, epoch, root, index: receiptIndex() });
  let staged: Awaited<ReturnType<typeof indexOrderedCheckpoint>> | undefined;
  return {
    recordFormat: "ordered" as const,
    references,
    async connect(space: SyncSpace, relay: DocumentRelay) {
      if (connected === relay) return;
      if (!relay.manifestBlobs) throw new Error("Ordered receipts require relay manifest graph support");
      cache = createOrderedManifestCache(db, owner, space, await relay.manifestBlobs());
      index = createOrderedReceiptIndex({ space, blobs: cache.blobs });
      connected = relay;
    },
    open: () => run(async (_journal, tx) => orderedCursor(await readOrderedOwner(tx, owner))),
    checkpointPending: () =>
      run(async (_journal, tx) => {
        const roots = receiptRoots((await readOrderedOwner(tx, owner)).receipt_root);
        return !sameReceiptRoot(roots.root, roots.published);
      }),
    async apply(frames: (RecordFrame | null)[], cursor: RecordStreamCursor) {
      const result = await run(async (journal, tx) => {
        const { epoch } = await readOrderedOwner(tx, owner);
        if (!epoch) throw new Error("An ordered stream has no epoch");
        const changed = new Set<string>();
        const rejected: number[] = [];
        for (const [position, frame] of frames.entries()) {
          if (!frame) {
            rejected.push(position);
            continue;
          }
          for (const id of await applyOrderedStreamFrame(journal, tx, frame, epoch, applyAdmission, applyNative))
            changed.add(id);
        }
        const saved = await rebaseOrderedProjection(journal, tx, owner, [...changed]);
        const next = await coverOrderedReceiptRoot(journal, tx, owner, receiptIndex(), {
          ...cursor,
          skipped: cursor.skipped || rejected.length > 0,
        });
        await saveOrderedCursor(tx, owner, next);
        return { ...saved, rejected, cursor: next };
      });
      if (result.projected) deps.statistics.record(result.projected);
      notify(result.events);
      return { rejected: result.rejected, cursor: result.cursor };
    },
    async merge(remote: Map<string, Uint8Array[]>, _mode: "adopt" | "repair", cursor: RecordStreamCursor) {
      const result = await run((journal, tx) => mergeIn(journal, tx, remote, cursor));
      notify(result.events);
      return { rejected: result.rejected, cursor: result.cursor };
    },
    outbox: (_limit: number) => run((journal, tx) => nextOrderedUpload(journal, tx, owner, receiptIndex())),
    sent: (sequence: number) =>
      run(async (journal, tx) => {
        const { epoch } = await readOrderedOwner(tx, owner);
        if (!epoch) throw new Error("Delivery requires an admitted order");
        const [local] = await journal.pending({ after: sequence - 1, limit: 1 });
        if (local && local.sequence === sequence) await journal.delivered([local.operation.operationId], epoch);
      }),
    async snapshot(options?: { found: boolean; relayEmpty?: boolean }) {
      const draft = await run(async (journal, tx) => {
        const row = await readOrderedOwner(tx, owner);
        const found = options?.found ?? !row.epoch;
        const root = receiptRoots(row.receipt_root).root;
        const resolver = createOrderedReceiptResolver(journal, root, receiptIndex());
        const epoch = found ? crypto.randomUUID() : row.epoch!;
        if (found) await rebaseOrderedProjection(journal, tx, owner, await resolver.reconcilePending(epoch));
        return {
          stage: await stageOrderedCheckpoint(journal, tx, owner, epoch, found, resolver.probeDependency),
          root,
        };
      });
      if (draft.stage.found && draft.root) {
        if (!options?.relayEmpty) throw new Error("Rebuilding a receipt graph requires confirmed relay loss");
        await cache!.replay(draft.root);
      }
      staged = await indexOrderedCheckpoint(draft.stage, receiptIndex(), draft.root);
      return staged;
    },
    async published(cursor: RecordStreamCursor, _outbox: number) {
      if (!staged) throw new Error("No staged checkpoint");
      const snapshot = staged;
      staged = undefined;
      const saved = await run(async (journal, tx) => {
        const current = await readOrderedOwner(tx, owner);
        if (!snapshot.found && current.epoch === snapshot.epoch && current.after > snapshot.base.after) {
          const roots = receiptRoots(current.receipt_root);
          const root = await receiptIndex().merge(snapshot.root, roots.root);
          await saveReceiptRoots(tx, owner, { version: 1, root, published: snapshot.root, stateId: cursor.stateId });
          const next = {
            ...cursor,
            after: current.after,
            pendingBytes: Math.max(0, current.pending_bytes - snapshot.base.pendingBytes),
            receiptRoot: snapshot.root,
            receiptStateId: cursor.stateId,
          };
          await saveOrderedCursor(tx, owner, next);
          await journal.markIndexed(snapshot.receipts);
          return { cursor: next, events: [] as NumberChange[] };
        }
        const remote = new Map(snapshot.records.map((record) => [record.recordId, [record.bytes]]));
        const result = await mergeIn(journal, tx, remote, cursor);
        for (const included of snapshot.native) await journal.completeNative(included.operation, included.state);
        await journal.markIndexed(snapshot.receipts);
        return { cursor: result.cursor, events: result.events };
      });
      notify(saved.events);
      return saved.cursor;
    },
    hasRecords: () =>
      run(
        async (journal, tx) =>
          (await journal.pending({ limit: 1 })).length > 0 ||
          (
            await tx
              .select({ id: canonical.record_id })
              .from(canonical)
              .where(orderedOwnerWhere(canonical, owner))
              .limit(1)
          ).length > 0,
      ),
    pending: () => run(async (journal) => (await journal.pending({ limit: 1 })).length > 0),
  } satisfies RecordStreamStore;
};
