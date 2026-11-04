import { fingerprint, type Json } from "pstdio-sync-contracts";
import {
  applyJsonChanges,
  type JsonChange,
  type ObservedJson,
  observeJson,
  overlappingJsonStamps,
  replacementChanges,
  stampJsonChanges,
  unchangedJsonPaths,
} from "./ordered-json";

/** Canonical plain data. A query projection can overlay unresolved local operations on this state. */
export interface OrderedRecord {
  recordId: string;
  value: Json;
  deleted: boolean;
  lifetime: string;
  stamps: Record<string, string>;
}
interface Observation {
  version: 1;
  exists: boolean;
  deleted: boolean;
  lifetime: string | null;
  value: ObservedJson;
  stamps: Record<string, string>;
}
export interface OrderedEdit {
  recordId: string;
  replace?: Json;
  deleted?: boolean;
  /** Replacement baseline only; passing an observation does not make a save conditional. */
  observedRevision?: string;
  /** Refuse the whole group when this observation's written paths or lifetime have changed. */
  expectedRevision?: string;
}
export interface OrderedOperation {
  version: 1;
  operationId: string;
  fingerprint: string;
  edits: {
    recordId: string;
    changes: JsonChange[];
    deleted?: boolean;
    condition?: Observation;
  }[];
}
/** Delivery coordinates can change after true relay loss; authored conditions remain immutable. */
export interface OrderedAdmission {
  epoch: string;
  operation: OrderedOperation;
  dependencies: { operationId: string; fingerprint: string; epoch: string }[];
}
export interface OrderedDecision {
  epoch: string;
  operationId: string;
  fingerprint: string;
  state: "accepted" | "refused";
}

/** Portable across commands and restarts; old leaf content is represented by digests. */
export const observeOrderedRecord = async (record: OrderedRecord | undefined) =>
  JSON.stringify({
    version: 1,
    exists: !!record,
    deleted: record?.deleted ?? false,
    lifetime: record?.lifetime ?? null,
    value: await observeJson(record?.value ?? null),
    stamps: record?.stamps ?? {},
  } satisfies Observation);

const observation = (revision: string) => {
  const value = JSON.parse(revision) as Observation;
  if (value.version !== 1 || typeof value.exists !== "boolean" || typeof value.deleted !== "boolean")
    throw new Error("Invalid ordered record observation");
  return value;
};

/** Prepare once and persist this immutable envelope before opening transport. */
export const prepareOrderedOperation = async (
  group: { operationId: string; edits: OrderedEdit[] },
  records: ReadonlyMap<string, OrderedRecord>,
) => {
  if (!group.operationId || !group.edits.length) throw new Error("Empty storage commit");
  const ids = group.edits.map(({ recordId }) => recordId);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error("A commit must name each record once");
  const edits: OrderedOperation["edits"] = [];
  for (const edit of group.edits) {
    if (edit.replace === undefined && edit.deleted === undefined) throw new Error("Empty record edit");
    const revision =
      edit.observedRevision ?? edit.expectedRevision ?? (await observeOrderedRecord(records.get(edit.recordId)));
    const before = observation(revision);
    edits.push({
      recordId: edit.recordId,
      changes:
        edit.replace === undefined
          ? []
          : await replacementChanges(before.exists && !before.deleted ? before.value : undefined, edit.replace),
      ...(edit.deleted === undefined ? {} : { deleted: edit.deleted }),
      ...(edit.expectedRevision === undefined ? {} : { condition: observation(edit.expectedRevision) }),
    });
  }
  const envelope = { version: 1 as const, operationId: group.operationId, edits };
  return { ...envelope, fingerprint: await fingerprint(envelope as unknown as Json) } satisfies OrderedOperation;
};

const canonicalStamp = (epoch: string, operationId: string) => JSON.stringify(["canonical", epoch, operationId]);
const pendingStamp = (operation: OrderedOperation) =>
  JSON.stringify(["pending", operation.operationId, operation.fingerprint]);

class RefusedDependency extends Error {}

const resolveStamp = (stamp: string, decisions: ReadonlyMap<string, OrderedDecision>, allowPending: boolean) => {
  if (stamp === "initial") return stamp;
  const parts = JSON.parse(stamp) as string[];
  if (parts[0] !== "pending") return stamp;
  const decision = decisions.get(parts[1]!);
  if (!decision) {
    if (allowPending) return stamp;
    throw new Error("An ordered dependency requires its exact receipt");
  }
  if (decision.operationId !== parts[1] || decision.fingerprint !== parts[2])
    throw new Error("Ordered dependency receipt does not match its identity");
  if (decision.state === "refused") throw new RefusedDependency();
  return canonicalStamp(decision.epoch, decision.operationId);
};

const accepts = (
  record: OrderedRecord | undefined,
  edit: OrderedOperation["edits"][number],
  decisions: ReadonlyMap<string, OrderedDecision>,
  optimistic: boolean,
) => {
  const observed = edit.condition;
  if (!observed) return true;
  const normalize = (stamp: string, current: string | undefined) =>
    resolveStamp(stamp, decisions, optimistic && stamp === current);
  const lifetime = record?.lifetime;
  if (
    observed.exists !== !!record ||
    (observed.lifetime === null ? null : normalize(observed.lifetime, lifetime)) !==
      (lifetime === undefined ? null : normalize(lifetime, lifetime)) ||
    observed.deleted !== (record?.deleted ?? false)
  )
    return false;
  // Deletion writes the whole record, including paths added after its observation.
  const lifecycle = edit.deleted === true || (edit.deleted === false && observed.deleted);
  const paths = lifecycle ? [{ path: [], remove: true as const }] : edit.changes;
  const stamps = Object.fromEntries(
    Object.entries(overlappingJsonStamps(observed.stamps, paths)).map(([pointer, stamp]) => [
      pointer,
      normalize(stamp, record?.stamps[pointer]),
    ]),
  );
  const current = Object.fromEntries(
    Object.entries(overlappingJsonStamps(record?.stamps ?? {}, paths)).map(([pointer, stamp]) => [
      pointer,
      normalize(stamp, stamp),
    ]),
  );
  return unchangedJsonPaths(stamps, current, paths);
};

const conditionAccepted = (...args: Parameters<typeof accepts>) => {
  try {
    return accepts(...args);
  } catch (error) {
    if (error instanceof RefusedDependency) return false;
    throw error;
  }
};

const applyRecord = (before: OrderedRecord | undefined, edit: OrderedOperation["edits"][number], stamp: string) => {
  // Ordinary stale writes never resurrect a deleted record. Recreating it is explicit.
  if (before?.deleted && edit.deleted === undefined) return;
  const recreating = before?.deleted && edit.deleted === false;
  const deleted = edit.deleted ?? before?.deleted ?? false;
  const lifecycle = !before || recreating || before.deleted !== deleted;
  const changes = edit.changes;
  const stamps = stampJsonChanges(before?.stamps ?? {}, changes, stamp);
  if (lifecycle) stamps[""] = stamp;
  return {
    recordId: edit.recordId,
    // A tombstone hides its value but retains it for an explicit restore without replacement.
    value: applyJsonChanges(recreating && changes.length ? null : (before?.value ?? null), changes),
    deleted,
    lifetime: lifecycle && (before || deleted) ? stamp : (before?.lifetime ?? "initial"),
    stamps,
  };
};

/** Apply one relay-ordered atomic group; callers persist its decision and records with the cursor. */
export const applyOrderedOperation = (
  current: ReadonlyMap<string, OrderedRecord>,
  operation: OrderedOperation,
  epoch: string,
  previous?: OrderedDecision,
  dependencies: ReadonlyMap<string, OrderedDecision> = new Map(),
) => {
  if (previous) {
    if (previous.operationId !== operation.operationId || previous.fingerprint !== operation.fingerprint)
      throw new Error("Operation identity reused with changed payload");
    if (previous.epoch !== epoch) throw new Error("An ordered decision belongs to another epoch");
    return { decision: previous, records: [] as OrderedRecord[] };
  }
  const decision: OrderedDecision = {
    epoch,
    operationId: operation.operationId,
    fingerprint: operation.fingerprint,
    state: operation.edits.every((edit) => conditionAccepted(current.get(edit.recordId), edit, dependencies, false))
      ? "accepted"
      : "refused",
  };
  const records: OrderedRecord[] = [];
  if (decision.state === "refused") return { decision, records };
  for (const edit of operation.edits) {
    const record = applyRecord(current.get(edit.recordId), edit, canonicalStamp(epoch, operation.operationId));
    if (record) records.push(record);
  }
  return { decision, records };
};

/** Pending overlays use authored identities until exact ordered receipts resolve their dependencies. */
export const projectOrderedOperation = (
  current: ReadonlyMap<string, OrderedRecord>,
  operation: OrderedOperation,
  dependencies: ReadonlyMap<string, OrderedDecision> = new Map(),
) => {
  if (!operation.edits.every((edit) => conditionAccepted(current.get(edit.recordId), edit, dependencies, true)))
    return [];
  return operation.edits.flatMap((edit) => {
    const record = applyRecord(current.get(edit.recordId), edit, pendingStamp(operation));
    return record ? [record] : [];
  });
};
