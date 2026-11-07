import { type JsonChange, jsonPointer, overlappingJsonStamps, unchangedJsonPaths } from "./ordered-json";
import type { OrderedLifetime, OrderedOperation, OrderedRecord } from "./ordered-operation";

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

type OrderedEditInput = OrderedOperation["edits"][number];

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

const stampOperation = (stamp: string) => {
  if (stamp === "initial") return undefined;
  const [kind, first, second] = JSON.parse(stamp) as string[];
  if (kind === "canonical") return second;
  if (kind === "pending") return first;
  return undefined;
};

interface BaseCheck {
  /** Resolves pending stamps through exact receipts, like conditions do. */
  normalize: (stamp: string) => string;
  /** Writes by the saves this one replaces are this device's own and leave the base current. */
  superseded: (stamp: string) => boolean;
}

const sameStamps = (
  base: Record<string, string>,
  current: Record<string, string>,
  paths: JsonChange[],
  check: BaseCheck,
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
  for (const [pointer, stamp] of Object.entries(after))
    if (check.superseded(stamp)) {
      if (Object.hasOwn(before, pointer)) after[pointer] = before[pointer]!;
      else delete after[pointer];
    }
  const normalized = (stamps: Record<string, string>) =>
    Object.fromEntries(Object.entries(stamps).map(([pointer, stamp]) => [pointer, check.normalize(stamp)]));
  return unchangedJsonPaths(normalized(before), normalized(after), paths);
};

/** Deleting or restoring decides the whole record, so any change after the base keeps the in-sync record. */
const lifecycleCurrent = (record: OrderedRecord | undefined, base: OrderedBase, check: BaseCheck) => {
  const moved =
    base.exists &&
    !(record && check.superseded(record.lifetime)) &&
    (!record ||
      base.deleted !== record.deleted ||
      (base.lifetime === null ? null : check.normalize(base.lifetime)) !== check.normalize(record.lifetime));
  return !moved && sameStamps(base.stamps, record?.stamps ?? {}, [{ path: [], remove: true }], check);
};

/** Plain edits compare only their own paths: a restore elsewhere leaves untouched fields writable. */
const pathEdit = (record: OrderedRecord | undefined, edit: OrderedEditInput, base: OrderedBase, check: BaseCheck) => {
  const kept: JsonChange[] = [];
  const skipped: string[] = [];
  for (const change of edit.changes) {
    if (sameStamps(base.stamps, record?.stamps ?? {}, [change], check)) kept.push(change);
    else skipped.push(jsonPointer(change.path));
  }
  if (!skipped.length) return { edit };
  const skip = { recordId: edit.recordId, paths: skipped, whole: false };
  // Nothing left to write: keep the record exactly as the in-sync devices left it.
  if (record && !kept.length && !edit.texts?.length && edit.deleted === undefined) return { skip };
  return { edit: { ...edit, changes: kept }, skip };
};

/**
 * In-sync devices win: a path applies only while its write stamps still match the author's base.
 * Every device evaluates this identically in relay order, so the blind relay needs no rule.
 */
export const baseEdit = (
  record: OrderedRecord | undefined,
  edit: OrderedEditInput,
  normalize: (stamp: string) => string,
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
  const check: BaseCheck = {
    normalize,
    superseded: (stamp) => {
      const id = stampOperation(stamp);
      return id !== undefined && supersedes.has(id);
    },
  };
  if (lifecycleEdit(edit.deleted, base.deleted)) return lifecycleCurrent(record, base, check) ? { edit } : whole();
  return pathEdit(record, edit, base, check);
};

/**
 * One save stays an atomic group (ADR 0137): when the base rule drops any part of a save that spans
 * several records, the whole save is dropped, so a created record never lands without its link.
 * Saves without a base keep the earlier rule, and saves with collaborative text keep per-edit skips
 * because their text updates always merge.
 */
export const baseOperation = (
  current: ReadonlyMap<string, OrderedRecord>,
  operation: OrderedOperation,
  normalize: (stamp: string) => string,
) => {
  const supersedes = new Set(operation.supersedes);
  const results = operation.edits.map((input) => {
    const before = current.get(input.recordId);
    return { before, based: !!input.base, ...baseEdit(before, input, normalize, supersedes) };
  });
  const atomic = operation.edits.length > 1 && operation.edits.every((edit) => !edit.texts?.length);
  if (atomic && results.some((result) => result.skip && result.based))
    return {
      edits: [],
      skipped: operation.edits.flatMap((edit) =>
        edit.changes.length || edit.deleted !== undefined
          ? [{ recordId: edit.recordId, paths: edit.changes.map((change) => jsonPointer(change.path)), whole: true }]
          : [],
      ),
    };
  return {
    edits: results.flatMap((result) => (result.edit ? [{ before: result.before, edit: result.edit }] : [])),
    skipped: results.flatMap((result) => (result.skip ? [result.skip] : [])),
  };
};
