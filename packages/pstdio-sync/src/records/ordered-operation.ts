import { fingerprint, type Json } from "pstdio-sync-contracts";
import { baseOperation, type OrderedBase, type OrderedSkip, orderedBase } from "./ordered-base";
import {
  applyJsonChanges,
  type JsonChange,
  type ObservedJson,
  observeJson,
  overlappingJsonStamps,
  replacementChanges,
  stampJsonChanges,
  unchangedJsonPaths,
  validateJsonChanges,
} from "./ordered-json";
import { readOrderedObservation } from "./ordered-operation-wire";

export { type OrderedBase, type OrderedSkip, orderedBase } from "./ordered-base";

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

const lifetimeObservation = (revision: string) => {
  const { version, exists, deleted, lifetime } = readOrderedObservation(revision);
  return { version, exists, deleted, lifetime };
};

const preparedEdit = async (edit: OrderedEdit, current: OrderedRecord | undefined) => {
  if (edit.replace === undefined && edit.changes === undefined && edit.deleted === undefined)
    throw new Error("Empty record edit");
  const changes = await preparedChanges(edit, current);
  const base = edit.base === undefined ? orderedBase(current, changes, edit.deleted) : (edit.base ?? undefined);
  let condition: OrderedObservation | OrderedLifetime | undefined;
  if (edit.expectedRevision !== undefined) condition = readOrderedObservation(edit.expectedRevision);
  else if (edit.expectedLifetime !== undefined) condition = lifetimeObservation(edit.expectedLifetime);
  return {
    recordId: edit.recordId,
    changes,
    ...(edit.texts?.length ? { texts: structuredClone(edit.texts) } : {}),
    ...(edit.deleted === undefined ? {} : { deleted: edit.deleted }),
    ...(condition ? { condition } : {}),
    ...(base ? { base } : {}),
  } satisfies OrderedOperation["edits"][number];
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
  for (const edit of group.edits) edits.push(await preparedEdit(edit, records.get(edit.recordId)));
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

/** A refused dependency never became canonical, so a base written over it is no longer current. */
const baseNormalizer = (decisions: ReadonlyMap<string, OrderedDecision>, optimistic: boolean) => (stamp: string) => {
  try {
    return resolveStamp(stamp, decisions, optimistic);
  } catch (error) {
    if (error instanceof RefusedDependency) return JSON.stringify(["refused", stamp]);
    throw error;
  }
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
  const based = baseOperation(current, operation, baseNormalizer(dependencies, false));
  skipped.push(...based.skipped);
  for (const { before, edit } of based.edits) {
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
  return baseOperation(current, operation, baseNormalizer(dependencies, true)).edits.flatMap(({ before, edit }) => {
    const record = applyRecord(before, edit, pendingStamp(operation));
    return record ? [record] : [];
  });
};
