import { fingerprint } from "pstdio-sync-contracts";
import { jsonPointer, stampJsonChanges } from "./ordered-json";
import type { OrderedDecision, OrderedOperation, OrderedRecord } from "./ordered-operation";
import { applyBoundedOrderedOperation, projectBoundedOrderedOperation } from "./ordered-policy";

/** Native frames carry only unconditional edits to already-declared text fields. */
export const validateOrderedNativeOperation = (operation: OrderedOperation) => {
  if (!operation.edits.length) throw new Error("A native text frame must edit an existing text field");
  for (const edit of operation.edits) {
    if (
      edit.changes.length ||
      Object.hasOwn(edit, "deleted") ||
      Object.hasOwn(edit, "condition") ||
      !edit.texts?.length
    )
      throw new Error("A native text frame can only edit existing text fields");
  }
  return operation;
};
const existingFields = (records: ReadonlyMap<string, OrderedRecord>, operation: OrderedOperation) =>
  operation.edits.every((edit) => {
    const before = records.get(edit.recordId);
    return (
      before &&
      !before.deleted &&
      edit.texts!.every((text) => Object.hasOwn(before.texts ?? {}, jsonPointer(text.path)))
    );
  });

/** Foreign editor replicas can carry a group before its canonical receipt reaches this host. */
export const orderedNativeDependenciesReady = (
  records: ReadonlyMap<string, OrderedRecord>,
  operation: OrderedOperation,
  decisions: ReadonlyMap<string, OrderedDecision>,
) =>
  operation.edits.every((edit) =>
    edit.texts!.every((text) =>
      text.dependencies.every(
        (dependency) =>
          decisions.has(dependency.operationId) ||
          Object.values(records.get(edit.recordId)?.texts ?? {}).some((state) =>
            state.pending.some(
              (item) => item.operationId === dependency.operationId && item.fingerprint === dependency.fingerprint,
            ),
          ),
      ),
    ),
  );

/** Stable Y-history observations replace frame IDs; duplicate structs cannot regress a later write stamp. */
const nativeRecords = async (
  before: ReadonlyMap<string, OrderedRecord>,
  operation: OrderedOperation,
  applied: OrderedRecord[],
  optimistic: boolean,
) => {
  const result: OrderedRecord[] = [];
  const edits = new Map(operation.edits.map((edit) => [edit.recordId, edit]));
  for (const record of applied) {
    const previous = before.get(record.recordId)!;
    const texts = { ...record.texts };
    let stamps = { ...previous.stamps };
    let changed = false;
    for (const text of edits.get(record.recordId)!.texts!) {
      const pointer = jsonPointer(text.path);
      const old = previous.texts![pointer]!;
      const next = texts[pointer]!;
      if (old.state === next.state) {
        texts[pointer] = old;
        continue;
      }
      changed = true;
      texts[pointer] = { ...next, pending: optimistic ? old.pending : [] };
      stamps = stampJsonChanges(
        stamps,
        [{ path: text.path, remove: true }],
        JSON.stringify(["text", next.seed, await fingerprint(next.state)]),
      );
    }
    if (changed) result.push({ ...record, stamps, texts });
  }
  return result;
};
export const applyOrderedNativeOperation = async (
  records: ReadonlyMap<string, OrderedRecord>,
  operation: OrderedOperation,
  epoch: string,
  decisions: ReadonlyMap<string, OrderedDecision> = new Map(),
) => {
  validateOrderedNativeOperation(operation);
  if (!existingFields(records, operation)) return { state: "refused" as const, records: [] as OrderedRecord[] };
  const result = await applyBoundedOrderedOperation(records, operation, epoch, undefined, decisions);
  return { state: result.decision.state, records: await nativeRecords(records, operation, result.records, false) };
};
export const projectOrderedNativeOperation = async (
  records: ReadonlyMap<string, OrderedRecord>,
  operation: OrderedOperation,
  decisions: ReadonlyMap<string, OrderedDecision> = new Map(),
) => {
  validateOrderedNativeOperation(operation);
  if (!existingFields(records, operation)) return [];
  if (!orderedNativeDependenciesReady(records, operation, decisions)) return [];
  return nativeRecords(records, operation, await projectBoundedOrderedOperation(records, operation, decisions), true);
};
