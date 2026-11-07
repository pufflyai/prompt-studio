import { and, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import {
  coreOwnerId,
  type OrderedBase,
  type OrderedOperation,
  type OrderedRecord,
  orderedBase,
  overlappingJsonStamps,
  prepareOrderedOperation,
  projectBoundedOrderedOperation,
  readOrderedPath,
} from "pstdio-sync/records";
import { canonicalJson, type Json } from "pstdio-sync-contracts";
import {
  storage_ordered_operations as operations,
  storage_ordered_owners as owners,
  storage_ordered_touches as touches,
} from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import { isOrderedNativeRequest } from "./ordered-native-identity";
import { pendingOrderedOperations } from "./ordered-pending";
import { knownDependencies } from "./ordered-rebase";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { orderedOwnerJoinedCloud, readOrderedOwner } from "./ordered-stream-state";

export type OrderedReturnState = NonNullable<(typeof owners.$inferSelect)["return_state"]>;

export const orderedReturnLimits = {
  /** Unsent saves per owner before a signed-in device folds them into one save per record. */
  fold: 1_000,
  /** A return with more deletions or changed records waits on this device until someone applies or discards it. */
  deletions: 25,
  records: 500,
  /** Smaller returns are also held when at least this many deletions remove half of the owner's records. */
  minimumDeletions: 3,
};

const foldRequestPrefix = "fold:";
export const isOrderedFoldRequest = (requestFingerprint: string | null | undefined) =>
  !!requestFingerprint?.startsWith(foldRequestPrefix);

type Local = Awaited<ReturnType<OrderedJournal["pending"]>>[number];

const unfolded = sql`(${operations.request_fingerprint} IS NULL OR ${operations.request_fingerprint} NOT LIKE ${`${foldRequestPrefix}%`})`;
const pendingWhere = (owner: StorageOwner) =>
  and(
    orderedOwnerWhere(operations, owner),
    sql`${operations.envelope} IS NOT NULL`,
    sql`${operations.settled_epoch} IS NULL`,
  );

/** Counts only saves that are not already folded, so a large folded return never refolds on every save. */
const overFoldLimit = async (tx: OrderedTransaction, owner: StorageOwner) => {
  const rows = await tx
    .select({ id: operations.operation_id })
    .from(operations)
    .where(and(pendingWhere(owner), eq(operations.delivered, false), unfolded))
    .offset(orderedReturnLimits.fold)
    .limit(1);
  return rows.length > 0;
};

export const setOrderedReturnState = (tx: OrderedTransaction, owner: StorageOwner, state: OrderedReturnState | null) =>
  tx.update(owners).set({ return_state: state }).where(orderedOwnerWhere(owners, owner));

export const editRecords = (local: Local) => local.operation.edits.map((edit) => edit.recordId);
const foldable = (local: Local) =>
  !isOrderedNativeRequest(local.requestFingerprint) && local.operation.edits.every((edit) => !edit.texts?.length);

/** Every pending save sharing a record with the scope, so atomic groups fold or stay whole. */
const pendingGroups = async (journal: OrderedJournal, scope: string[]) => {
  const ids = new Set(scope);
  const found = new Map<string, Local>();
  let frontier = [...ids];
  while (frontier.length) {
    const next = new Set<string>();
    for await (const local of pendingOrderedOperations(journal, frontier)) {
      found.set(local.operation.operationId, local);
      for (const id of editRecords(local))
        if (!ids.has(id)) {
          ids.add(id);
          next.add(id);
        }
    }
    frontier = [...next];
  }
  return [...found.values()].sort((first, second) => first.sequence - second.sequence);
};

const pendingStampOf = (stamp: string | null) => {
  if (!stamp || stamp === "initial") return undefined;
  const [kind, id] = JSON.parse(stamp) as string[];
  return kind === "pending" ? id : undefined;
};

const minimalPaths = (paths: string[][]) => {
  const unique = [...new Map(paths.map((path) => [JSON.stringify(path), path])).values()];
  return unique.filter(
    (path) => !unique.some((other) => other.length < path.length && other.every((part, index) => part === path[index])),
  );
};

const same = (first: Json | undefined, second: Json | undefined) =>
  first === undefined || second === undefined ? first === second : canonicalJson(first) === canonicalJson(second);

/** The values the folded saves left visible, written only where they differ from Cloud's copy. */
const foldedChanges = (
  edits: OrderedOperation["edits"],
  before: OrderedRecord | undefined,
  view: OrderedRecord,
  restoring: boolean,
) => {
  const changes: OrderedOperation["edits"][number]["changes"] = [];
  if (view.deleted) return changes;
  const visible = before && !before.deleted ? before.value : undefined;
  for (const path of minimalPaths(edits.flatMap((edit) => edit.changes.map((change) => change.path)))) {
    const next = readOrderedPath(view.value, path);
    if (!restoring && same(next, visible === undefined ? undefined : readOrderedPath(visible, path))) continue;
    changes.push(next === undefined ? { path, remove: true } : { path, set: structuredClone(next) });
  }
  return changes;
};

/** Each pointer keeps the stamp the earliest folded save saw; stamps of folded saves are their own writes. */
const foldedBase = (
  edits: OrderedOperation["edits"],
  before: OrderedRecord | undefined,
  folded: ReadonlySet<string>,
  edit: { changes: OrderedOperation["edits"][number]["changes"]; deleted?: boolean },
): OrderedBase => {
  const own = (stamp: string | null) => {
    const id = pendingStampOf(stamp);
    return id !== undefined && folded.has(id);
  };
  const stamps: Record<string, string> = {};
  let observed: Omit<OrderedBase, "stamps"> | undefined;
  for (const authored of edits) {
    // Saves from before bases existed observed at most the canonical state they are folded over.
    const base = authored.base ?? orderedBase(before, authored.changes, authored.deleted);
    if (!base) continue;
    if (!observed && !own(base.lifetime))
      observed = { version: 1, exists: base.exists, deleted: base.deleted, lifetime: base.lifetime };
    for (const [pointer, stamp] of Object.entries(base.stamps))
      if (!Object.hasOwn(stamps, pointer) && !own(stamp)) stamps[pointer] = stamp;
  }
  observed ??= {
    version: 1,
    exists: !!before,
    deleted: before?.deleted ?? false,
    lifetime: before?.lifetime ?? null,
  };
  if (!observed.exists) return { ...observed, stamps: {} };
  const whole = edit.deleted === true || (edit.deleted === false && observed.deleted);
  return { ...observed, stamps: overlappingJsonStamps(stamps, whole ? [{ path: [], remove: true }] : edit.changes) };
};

/** One save that carries what these saves changed, against the earliest Cloud state they saw. */
const foldedEdit = (
  recordId: string,
  edits: OrderedOperation["edits"],
  before: OrderedRecord | undefined,
  view: OrderedRecord | undefined,
  folded: ReadonlySet<string>,
) => {
  // A record created and deleted while away never reached Cloud.
  if (!view || (!before && view.deleted)) return;
  const lifecycle = edits.some((edit) => edit.deleted !== undefined);
  const deleted = lifecycle && before && view.deleted !== before.deleted ? view.deleted : undefined;
  if (view.deleted && deleted === undefined) return;
  const changes = foldedChanges(edits, before, view, deleted === false);
  if (!changes.length && deleted === undefined) return;
  const edit = { changes, ...(deleted === undefined ? {} : { deleted }) };
  return { recordId, ...edit, base: foldedBase(edits, before, folded, edit) };
};

/** Replays every pending save on these records over canonical state, exactly like the visible projection. */
const projectedViews = async (journal: OrderedJournal, groups: Local[], ids: string[]) => {
  const views = new Map(await journal.canonical(ids));
  const suppressed = new Set<string>();
  for (const local of groups) {
    const { operation } = local;
    const decisions = await knownDependencies(journal, operation);
    if ([...decisions.values()].some((decision) => decision.state === "refused")) {
      suppressed.add(operation.operationId);
      continue;
    }
    const projected = isOrderedNativeRequest(local.requestFingerprint)
      ? []
      : await projectBoundedOrderedOperation(views, operation, decisions);
    for (const record of projected) views.set(record.recordId, record);
  }
  return views;
};

/** Collaborative text keeps its CRDT history per save, so records it touches never fold. */
const blockedRecords = (groups: Local[]) => {
  const blocked = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const local of groups) {
      const ids = editRecords(local);
      if (foldable(local) && !ids.some((id) => blocked.has(id))) continue;
      for (const id of ids.filter((id) => !blocked.has(id))) {
        blocked.add(id);
        grew = true;
      }
    }
  }
  return blocked;
};

/** Drop unsent saves. Each identity row stays so retries and outcomes still resolve. */
export const dropPending = async (tx: OrderedTransaction, owner: StorageOwner, ids: string[]) => {
  for (let offset = 0; offset < ids.length; offset += 1_000) {
    const page = ids.slice(offset, offset + 1_000);
    await tx
      .update(operations)
      .set({ envelope: null, admission: null, admission_epoch: null, admission_fingerprint: null })
      .where(and(orderedOwnerWhere(operations, owner), inArray(operations.operation_id, page)));
    await tx.delete(touches).where(and(orderedOwnerWhere(touches, owner), inArray(touches.operation_id, page)));
  }
};

/** Fold unsent saves on these records into one save per record. */
const foldScope = async (journal: OrderedJournal, tx: OrderedTransaction, owner: StorageOwner, scope: string[]) => {
  const groups = await pendingGroups(journal, scope);
  const blocked = blockedRecords(groups);
  const folding = groups.filter((local) => !local.delivered && !editRecords(local).some((id) => blocked.has(id)));
  const perRecord = new Map<string, Local[]>();
  for (const local of folding)
    for (const id of editRecords(local)) perRecord.set(id, [...(perRecord.get(id) ?? []), local]);
  // Already one folded save per record: nothing to do.
  const settled = [...perRecord.values()].every(
    (locals) => locals.length === 1 && isOrderedFoldRequest(locals[0]!.requestFingerprint),
  );
  if (settled) return [];
  const ids = [...new Set(groups.flatMap(editRecords))];
  const canonical = await journal.canonical(ids);
  const views = await projectedViews(journal, groups, ids);
  const foldedIds = new Set(folding.map((local) => local.operation.operationId));
  const replacements: OrderedOperation[] = [];
  for (const [recordId, locals] of perRecord) {
    const edits = locals.flatMap((local) => local.operation.edits.filter((edit) => edit.recordId === recordId));
    const edit = foldedEdit(recordId, edits, canonical.get(recordId), views.get(recordId), foldedIds);
    if (!edit) continue;
    // Saves that may already be in Cloud: admitted for upload, or replaced by an earlier fold.
    const supersedes = locals.flatMap((local) => [
      ...(local.admission ? [local.operation.operationId] : []),
      ...(local.operation.supersedes ?? []),
    ]);
    replacements.push(
      await prepareOrderedOperation({ operationId: crypto.randomUUID(), supersedes, edits: [edit] }, canonical),
    );
  }
  await dropPending(tx, owner, [...foldedIds]);
  for (const operation of replacements) await journal.queue(operation, `${foldRequestPrefix}${operation.fingerprint}`);
  return [...perRecord.keys()];
};

const unfoldedRecords = async (tx: OrderedTransaction, owner: StorageOwner) => {
  const rows = await tx
    .selectDistinct({ recordId: touches.record_id })
    .from(touches)
    .innerJoin(
      operations,
      and(
        eq(operations.workbench_id, touches.workbench_id),
        eq(operations.extension_id, touches.extension_id),
        eq(operations.operation_id, touches.operation_id),
      ),
    )
    .where(and(pendingWhere(owner), eq(operations.delivered, false), unfolded));
  return rows.map((row) => row.recordId);
};

/** Fold every unsent save of this owner, a bounded page of records at a time. */
export const foldAllOrderedSaves = async (journal: OrderedJournal, tx: OrderedTransaction, owner: StorageOwner) => {
  const changed = new Set<string>();
  const ids = await unfoldedRecords(tx, owner);
  for (let offset = 0; offset < ids.length; offset += 200) {
    const page = ids.slice(offset, offset + 200).filter((id) => !changed.has(id));
    for (const id of await foldScope(journal, tx, owner, page)) changed.add(id);
  }
  return [...changed];
};

/**
 * Keep a joined owner's unsent saves bounded. While signed out, folded or held, each save folds
 * into the record's single pending save; while signed in, passing the limit folds them all.
 */
export const foldOrderedSaves = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  changed: string[],
) => {
  if (owner.extensionId === coreOwnerId) return [];
  const row = await readOrderedOwner(tx, owner);
  if (!row.return_state) {
    if (!(await orderedOwnerJoinedCloud(tx, owner, row)) || !(await overFoldLimit(tx, owner))) return [];
    await setOrderedReturnState(tx, owner, "folded");
    return foldAllOrderedSaves(journal, tx, owner);
  }
  return changed.length ? foldScope(journal, tx, owner, changed) : [];
};

/** Whether a save must take the full rebase path so it can fold. */
export const orderedSavesFold = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  row: { return_state: string | null },
) => owner.extensionId !== coreOwnerId && (!!row.return_state || (await overFoldLimit(tx, owner)));
