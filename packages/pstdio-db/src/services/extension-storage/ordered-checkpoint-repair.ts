import { and, gt } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import {
  type OrderedEdit,
  type OrderedRecord,
  parseJsonPointer,
  prepareOrderedOperation,
  readOrderedPath,
} from "pstdio-sync/records";
import type { createOrderedReceiptIndex, OrderedIndexReference } from "pstdio-sync/relay";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import { storage_ordered_records as canonical } from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

type Index = ReturnType<typeof createOrderedReceiptIndex>;
const occurrence = (stamp: string) => {
  if (!stamp.startsWith("[")) return;
  const [kind, epoch, operationId] = JSON.parse(stamp) as string[];
  return kind === "canonical" && epoch !== "legacy" ? { epoch: epoch!, operationId: operationId! } : undefined;
};
// Assets and native sources need their own verified transport; declared text keeps its own history.
const repairable = (pointer: string, local: OrderedRecord) =>
  pointer !== "" &&
  !pointer.startsWith("/asset") &&
  !pointer.startsWith("/nativeSources") &&
  !Object.keys(local.texts ?? {}).some((text) => pointer === text || pointer.startsWith(`${text}/`));

/** Missing paths of one record, or undefined when the checkpoint already reflects every local save. */
const recordRepair = async (
  local: OrderedRecord,
  checkpoint: OrderedRecord | undefined,
  covered: (stamp: string) => Promise<boolean>,
  known: (stamp: string) => Promise<boolean>,
) => {
  const missing: string[] = [];
  for (const [pointer, stamp] of Object.entries(local.stamps)) if (!(await covered(stamp))) missing.push(pointer);
  if (!missing.length) return;
  const { recordId } = local;
  if (local.deleted)
    return missing.includes("") && checkpoint && !checkpoint.deleted
      ? ({ recordId, deleted: true, changes: [] } satisfies OrderedEdit)
      : undefined;
  if (!checkpoint || checkpoint.deleted)
    return {
      recordId,
      changes: [{ path: [], set: structuredClone(local.value) }],
      ...(checkpoint?.deleted ? { deleted: false } : {}),
    } satisfies OrderedEdit;
  const changes: OrderedEdit["changes"] = [];
  for (const pointer of missing) {
    if (!repairable(pointer, local)) continue;
    // A checkpoint write this device never saw is newer than the omitted save; keep it.
    const later = Object.entries(checkpoint.stamps).filter(
      ([other]) =>
        other === pointer || other === "" || pointer.startsWith(`${other}/`) || other.startsWith(`${pointer}/`),
    );
    if (await Promise.all(later.map(([, stamp]) => known(stamp))).then((all) => all.includes(false))) continue;
    const path = parseJsonPointer(pointer);
    const value = readOrderedPath(local.value, path);
    changes.push(value === undefined ? { path, remove: true } : { path, set: structuredClone(value) });
  }
  return changes.length ? ({ recordId, changes } satisfies OrderedEdit) : undefined;
};

/**
 * A checkpoint can omit accepted saves this device already applied (ADR 0102 R19). Adopting it
 * would drop them, so each affected record is saved again as a new unconditional pending group
 * before canonical state is replaced. Its upload blocks compaction until relay order restores it.
 */
export const queueOrderedCheckpointRepairs = async (input: {
  journal: OrderedJournal;
  tx: OrderedTransaction;
  owner: StorageOwner;
  index: Index;
  checkpointRoot: OrderedIndexReference | null;
  localRoot: OrderedIndexReference | null;
  records: OrderedRecord[];
}) => {
  const { journal, tx, owner, index } = input;
  const remote = new Map(input.records.map((record) => [record.recordId, record]));
  const cache = new Map<string, Promise<boolean>>();
  const lookup = (root: OrderedIndexReference | null, prefix: string, stamp: string, local: boolean) => {
    const key = `${prefix}${stamp}`;
    let result = cache.get(key);
    if (!result) {
      const found = occurrence(stamp);
      result = found
        ? index
            .receipt(root, found.epoch, found.operationId)
            .then(
              async (receipt) =>
                !!receipt || (local && !!(await journal.cachedDecision(found.operationId, found.epoch))),
            )
        : Promise.resolve(true);
      cache.set(key, result);
    }
    return result;
  };
  const covered = (stamp: string) => lookup(input.checkpointRoot, "checkpoint:", stamp, false);
  const known = (stamp: string) => lookup(input.localRoot, "local:", stamp, true);
  const repaired: string[] = [];
  let after: string | undefined;
  while (true) {
    const rows = await tx
      .select({ id: canonical.record_id })
      .from(canonical)
      .where(and(orderedOwnerWhere(canonical, owner), after === undefined ? undefined : gt(canonical.record_id, after)))
      .orderBy(canonical.record_id)
      .limit(1_000);
    if (!rows.length) return repaired;
    for (const local of (await journal.canonical(rows.map((row) => row.id))).values()) {
      const edit = await recordRepair(local, remote.get(local.recordId), covered, known);
      if (!edit) continue;
      const operation = await prepareOrderedOperation(
        { operationId: `checkpoint-repair:${crypto.randomUUID()}`, edits: [edit] },
        remote,
      );
      await journal.queue(operation, await fingerprint(operation as unknown as Json));
      repaired.push(local.recordId);
    }
    after = rows.at(-1)!.id;
  }
};
