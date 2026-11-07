import { fingerprint, type Json } from "pstdio-sync-contracts";
import {
  applyJsonChanges,
  type JsonChange,
  jsonPointer,
  type ObservedJson,
  observeJson,
  overlappingJsonStamps,
  replacementChanges,
  stampJsonChanges,
  unchangedJsonPaths,
  validateJsonChanges,
} from "./ordered-json";
import { readOrderedObservation } from "./ordered-operation-wire";
import { mergeOrderedText, type OrderedTextChange, type OrderedTextState, retainOrderedTexts } from "./ordered-text";

/** Canonical plain data. A query projection can overlay unresolved local operations on this state. */
export interface OrderedRecord {
  recordId: string;
  value: Json;
  deleted: boolean;
  lifetime: string;
  stamps: Record<string, string>;
  texts?: Record<string, OrderedTextState>;
}
export interface OrderedLifetime {
  version: 1;
  exists: boolean;
  deleted: boolean;
  lifetime: string | null;
}
export interface OrderedObservation extends OrderedLifetime {
  value: ObservedJson;
  stamps: Record<string, string>;
}
/**
 * The record lifetime and the write stamps of every changed path as the author saw them.
 * Relay order applies a path only while it still has these stamps, so a device that saved
 * from an old view never overrides a later write it had not seen.
 */
export interface OrderedBase extends OrderedLifetime {
  stamps: Record<string, string>;
}
/** Paths a relay-ordered save did not apply because another write reached Cloud after its base. */
export interface OrderedSkip {
  recordId: string;
  /** JSON Pointers of plain changes that were not applied. */
  paths: string[];
  /** The whole edit was dropped: its record was deleted, recreated or (for a deletion) edited after the base. */
  whole: boolean;
}
export interface OrderedEdit {
  recordId: string;
  replace?: Json;
  /** Prepared host edits name only channels the author requested. */
  changes?: JsonChange[];
  texts?: OrderedTextChange[];
  deleted?: boolean;
  /** Replacement baseline only; passing an observation does not make a save conditional. */
  observedRevision?: string;
  /** Internal legacy saves merge fields while fencing the observed record lifetime. */
  expectedLifetime?: string;
  /** Refuse the whole group when this observation's written paths or lifetime have changed. */
  expectedRevision?: string;
  /**
   * Defaults to the prepared view's stamps. Folding several saves passes their earliest base;
   * `null` authors a save that applies in relay order without a base.
   */
  base?: OrderedBase | null;
}
export interface OrderedOperation {
  version: 1;
  operationId: string;
  fingerprint: string;
  /**
   * Earlier saves from the same device that this folded save replaces. They may already have
   * reached Cloud, so their writes count as part of this save's base rather than as newer writes.
   */
  supersedes?: string[];
  edits: {
    recordId: string;
    changes: JsonChange[];
    texts?: OrderedTextChange[];
    deleted?: boolean;
    condition?: OrderedObservation | OrderedLifetime;
    base?: OrderedBase;
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
  } satisfies OrderedObservation);

const preparedChanges = async (edit: OrderedEdit, current: OrderedRecord | undefined) => {
  if (edit.replace !== undefined && edit.changes !== undefined)
    throw new Error("Choose a replacement or explicit paths");
  if (edit.changes !== undefined) {
    validateJsonChanges(edit.changes);
    return structuredClone(edit.changes);
  }
  if (edit.replace === undefined) return [];
  const revision = edit.observedRevision ?? edit.expectedRevision ?? (await observeOrderedRecord(current));
  const before = readOrderedObservation(revision);
  if (before.deleted) return [{ path: [], set: structuredClone(edit.replace) }];
  return replacementChanges(before.exists && !before.deleted ? before.value : undefined, edit.replace);
};

/** Lifecycle edits guard the whole record; plain edits guard only the paths they write. */
const lifecycleEdit = (deleted: boolean | undefined, wasDeleted: boolean) =>
  deleted === true || (deleted === false && wasDeleted);

/** Text-only edits merge as CRDT updates and need no base. */
export const orderedBase = (
  record: OrderedRecord | undefined,
  changes: JsonChange[],
  deleted: boolean | undefined,
): OrderedBase | undefined => {
  if (!changes.length && deleted === undefined) return undefined;
  const whole = lifecycleEdit(deleted, record?.deleted ?? false);
  return {
    version: 1,
    exists: !!record,
    deleted: record?.deleted ?? false,
    lifetime: record?.lifetime ?? null,
    stamps: overlappingJsonStamps(record?.stamps ?? {}, whole ? [{ path: [], remove: true }] : changes),
  };
};

const lifetimeObservation = (revision: string) => {
  const { version, exists, deleted, lifetime } = readOrderedObservation(revision);
  return { version, exists, deleted, lifetime };
};

/** Prepare once and persist this immutable envelope before opening transport. */
export const prepareOrderedOperation = async (
  group: { operationId: string; edits: OrderedEdit[]; supersedes?: string[] },
  records: ReadonlyMap<string, OrderedRecord>,
) => {
  if (!group.operationId || !group.edits.length) throw new Error("Empty storage commit");
  const ids = group.edits.map(({ recordId }) => recordId);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error("A commit must name each record once");
  const edits: OrderedOperation["edits"] = [];
  for (const edit of group.edits) {
    if (edit.replace === undefined && edit.changes === undefined && edit.deleted === undefined)
      throw new Error("Empty record edit");
    const current = records.get(edit.recordId);
    const changes = await preparedChanges(edit, current);
    const base = edit.base === undefined ? orderedBase(current, changes, edit.deleted) : (edit.base ?? undefined);
    edits.push({
      recordId: edit.recordId,
      changes,
      ...(edit.texts?.length ? { texts: structuredClone(edit.texts) } : {}),
      ...(edit.deleted === undefined ? {} : { deleted: edit.deleted }),
      ...(edit.expectedRevision === undefined ? {} : { condition: readOrderedObservation(edit.expectedRevision) }),
      ...(edit.expectedRevision === undefined && edit.expectedLifetime !== undefined
        ? { condition: lifetimeObservation(edit.expectedLifetime) }
        : {}),
      ...(base ? { base } : {}),
    });
  }
  const supersedes = [...new Set(group.supersedes ?? [])].sort();
  const envelope = {
    version: 1 as const,
    operationId: group.operationId,
    ...(supersedes.length ? { supersedes } : {}),
    edits,
  };
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
  // An undecided pending stamp equals only itself, so an optimistic check can compare it as is.
  const normalize = (stamp: string) => resolveStamp(stamp, decisions, optimistic);
  const lifetime = record?.lifetime;
  if (
    observed.exists !== !!record ||
    (observed.lifetime === null ? null : normalize(observed.lifetime)) !==
      (lifetime === undefined ? null : normalize(lifetime)) ||
    observed.deleted !== (record?.deleted ?? false)
  )
    return false;
  if (!("stamps" in observed)) return true;
  // Deletion writes the whole record, including paths added after its observation.
  const lifecycle = edit.deleted === true || (edit.deleted === false && observed.deleted);
  const paths = lifecycle
    ? [{ path: [], remove: true as const }]
    : [...edit.changes, ...(edit.texts ?? []).map((text) => ({ path: text.path, remove: true as const }))];
  const stamps = Object.fromEntries(
    Object.entries(overlappingJsonStamps(observed.stamps, paths)).map(([pointer, stamp]) => [
      pointer,
      normalize(stamp),
    ]),
  );
  const current = Object.fromEntries(
    Object.entries(overlappingJsonStamps(record?.stamps ?? {}, paths)).map(([pointer, stamp]) => [
      pointer,
      normalize(stamp),
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

const textDependenciesAccepted = (
  record: OrderedRecord | undefined,
  edit: OrderedOperation["edits"][number],
  decisions: ReadonlyMap<string, OrderedDecision>,
  optimistic: boolean,
) => {
  for (const text of edit.texts ?? [])
    for (const dependency of text.dependencies) {
      const decision = decisions.get(dependency.operationId);
      if (!decision) {
        if (
          optimistic &&
          Object.values(record?.texts ?? {}).some((state) =>
            state.pending.some(
              (item) => item.operationId === dependency.operationId && item.fingerprint === dependency.fingerprint,
            ),
          )
        )
          continue;
        throw new Error("Ordered text requires its exact dependency receipt");
      }
      if (decision.operationId !== dependency.operationId || decision.fingerprint !== dependency.fingerprint)
        throw new Error("Ordered text dependency identity changed");
      if (decision.state === "refused") return false;
    }
  return true;
};

const acceptsEdit = (
  record: OrderedRecord | undefined,
  edit: OrderedOperation["edits"][number],
  decisions: ReadonlyMap<string, OrderedDecision>,
  optimistic: boolean,
) =>
  conditionAccepted(record, edit, decisions, optimistic) &&
  textDependenciesAccepted(record, edit, decisions, optimistic);

type OrderedEditInput = OrderedOperation["edits"][number];

const stampOperation = (stamp: string) => {
  if (stamp === "initial") return undefined;
  const [kind, first, second] = JSON.parse(stamp) as string[];
  return kind === "canonical" ? second : kind === "pending" ? first : undefined;
};

const sameStamps = (
  base: Record<string, string>,
  current: Record<string, string>,
  paths: JsonChange[],
  normalize: (stamp: string) => string,
  superseded: (stamp: string) => boolean,
) => {
  // The root stamp marks the record's lifecycle, which the base lifetime already guards. Two devices
  // creating the same record keep each other's unrelated fields.
  const root = paths.some((change) => !change.path.length);
  const resolve = (stamps: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(overlappingJsonStamps(stamps, paths)).flatMap(([pointer, stamp]) =>
        pointer === "" && !root ? [] : [[pointer, stamp] as const],
      ),
    );
  const before = resolve(base);
  const after = resolve(current);
  // Writes by the saves this one replaces are this device's own and leave the base current.
  for (const [pointer, stamp] of Object.entries(after))
    if (superseded(stamp)) {
      if (Object.hasOwn(before, pointer)) after[pointer] = before[pointer]!;
      else delete after[pointer];
    }
  const normalized = (stamps: Record<string, string>) =>
    Object.fromEntries(Object.entries(stamps).map(([pointer, stamp]) => [pointer, normalize(stamp)]));
  return unchangedJsonPaths(normalized(before), normalized(after), paths);
};

/**
 * In-sync devices win: a path applies only while its write stamps still match the author's base.
 * Every device evaluates this identically in relay order, so the blind relay needs no rule.
 */
const baseEdit = (
  record: OrderedRecord | undefined,
  edit: OrderedEditInput,
  decisions: ReadonlyMap<string, OrderedDecision>,
  optimistic: boolean,
  supersedes: ReadonlySet<string>,
): { edit?: OrderedEditInput; skip?: OrderedSkip } => {
  const whole = (): { skip?: OrderedSkip } =>
    edit.changes.length || edit.deleted !== undefined
      ? {
          skip: { recordId: edit.recordId, paths: edit.changes.map((change) => jsonPointer(change.path)), whole: true },
        }
      : {};
  // Ordinary stale writes never resurrect a deleted record. Recreating it is explicit.
  if (record?.deleted && edit.deleted === undefined) return whole();
  const base = edit.base;
  if (!base) return { edit };
  const superseded = (stamp: string) => {
    const id = stampOperation(stamp);
    return id !== undefined && supersedes.has(id);
  };
  // A refused dependency never became canonical, so a base written over it is no longer current.
  const normalize = (stamp: string) => {
    try {
      return resolveStamp(stamp, decisions, optimistic);
    } catch (error) {
      if (error instanceof RefusedDependency) return JSON.stringify(["refused", stamp]);
      throw error;
    }
  };
  if (
    base.exists &&
    !(record && superseded(record.lifetime)) &&
    (!record ||
      base.deleted !== record.deleted ||
      (base.lifetime === null ? null : normalize(base.lifetime)) !== normalize(record.lifetime))
  )
    return whole();
  if (lifecycleEdit(edit.deleted, base.deleted)) {
    const all = [{ path: [], remove: true as const }];
    return sameStamps(base.stamps, record?.stamps ?? {}, all, normalize, superseded) ? { edit } : whole();
  }
  const kept: JsonChange[] = [];
  const skipped: string[] = [];
  for (const change of edit.changes) {
    if (sameStamps(base.stamps, record?.stamps ?? {}, [change], normalize, superseded)) kept.push(change);
    else skipped.push(jsonPointer(change.path));
  }
  if (!skipped.length) return { edit };
  const skip = { recordId: edit.recordId, paths: skipped, whole: false };
  // Nothing left to write: keep the record exactly as the in-sync devices left it.
  if (record && !kept.length && !edit.texts?.length && edit.deleted === undefined) return { skip };
  return { edit: { ...edit, changes: kept }, skip };
};

const applyRecord = (before: OrderedRecord | undefined, edit: OrderedEditInput, stamp: string) => {
  // Ordinary stale writes never resurrect a deleted record. Recreating it is explicit.
  if (before?.deleted && edit.deleted === undefined) return;
  const recreating = before?.deleted && edit.deleted === false;
  const deleted = edit.deleted ?? before?.deleted ?? false;
  const lifecycle = !before || recreating || before.deleted !== deleted;
  const changes = edit.changes;
  const textChanges = edit.texts ?? [];
  const stamps = stampJsonChanges(
    before?.stamps ?? {},
    [...changes, ...textChanges.map((text) => ({ path: text.path, remove: true as const }))],
    stamp,
  );
  if (lifecycle) stamps[""] = stamp;
  const [kind, operationId, fingerprint] = JSON.parse(stamp) as string[];
  const retained = retainOrderedTexts(
    applyJsonChanges(before?.value ?? null, changes),
    recreating ? {} : (before?.texts ?? {}),
    changes,
    textChanges,
  );
  const merged = mergeOrderedText(
    retained.value,
    retained.texts,
    textChanges,
    kind === "pending" ? { operationId: operationId!, fingerprint: fingerprint! } : undefined,
  );
  return {
    recordId: edit.recordId,
    // A tombstone hides its value but retains it for an explicit restore without replacement.
    value: merged.value,
    deleted,
    lifetime: lifecycle && (before || deleted) ? stamp : (before?.lifetime ?? "initial"),
    stamps,
    ...(Object.keys(merged.texts).length ? { texts: merged.texts } : {}),
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
    return { decision: previous, records: [] as OrderedRecord[], skipped: [] as OrderedSkip[] };
  }
  const decision: OrderedDecision = {
    epoch,
    operationId: operation.operationId,
    fingerprint: operation.fingerprint,
    state: operation.edits.every((edit) => acceptsEdit(current.get(edit.recordId), edit, dependencies, false))
      ? "accepted"
      : "refused",
  };
  const records: OrderedRecord[] = [];
  const skipped: OrderedSkip[] = [];
  if (decision.state === "refused") return { decision, records, skipped };
  const supersedes = new Set(operation.supersedes);
  for (const input of operation.edits) {
    const before = current.get(input.recordId);
    const { edit, skip } = baseEdit(before, input, dependencies, false, supersedes);
    if (skip) skipped.push(skip);
    if (!edit) continue;
    const record = applyRecord(before, edit, canonicalStamp(epoch, operation.operationId));
    if (record) records.push(record);
  }
  return { decision, records, skipped };
};

/** Pending overlays use authored identities until exact ordered receipts resolve their dependencies. */
export const projectOrderedOperation = (
  current: ReadonlyMap<string, OrderedRecord>,
  operation: OrderedOperation,
  dependencies: ReadonlyMap<string, OrderedDecision> = new Map(),
) => {
  if (!operation.edits.every((edit) => acceptsEdit(current.get(edit.recordId), edit, dependencies, true))) return [];
  const supersedes = new Set(operation.supersedes);
  return operation.edits.flatMap((input) => {
    const before = current.get(input.recordId);
    const { edit } = baseEdit(before, input, dependencies, true, supersedes);
    const record = edit && applyRecord(before, edit, pendingStamp(operation));
    return record ? [record] : [];
  });
};
