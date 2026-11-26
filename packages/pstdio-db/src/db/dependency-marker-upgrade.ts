import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { readFileDocumentState } from "../services/extension-storage/document-file-persistence";
import { documentFilesFor, trackDocumentFiles } from "../services/extension-storage/document-files";
import { decodeOrderedJson, type OrderedTransaction } from "../services/extension-storage/ordered-sql";
import type { DbClient } from "./connection.pglite";
import { documents, operations, owners } from "./schemas.pg";

const prefix = '["ordered-dependency",';
const markerKey = sql`starts_with(${documents.key}, ${prefix}) AND ${documents.kind}='local'`;

// Local documents with similar names are legal. Only the canonical two-part host key is retired.
const operationId = (key: string) => {
  try {
    const parts: unknown = JSON.parse(key);
    if (
      Array.isArray(parts) &&
      parts.length === 2 &&
      typeof parts[1] === "string" &&
      JSON.stringify(["ordered-dependency", parts[1]]) === key
    )
      return parts[1];
  } catch {
    // A user document can start with the reserved text without being a marker.
  }
  return undefined;
};

const databaseText = (value: unknown): value is string =>
  typeof value === "string" && !value.includes("\0") && Buffer.from(value).toString() === value;

export const readLegacyEpoch = async (tx: OrderedTransaction, owner: StorageOwner & { id: number }, id: string) => {
  const [row] = await tx
    .select()
    .from(documents)
    .where(and(eq(documents.owner_id, owner.id), eq(documents.key, JSON.stringify(["ordered-dependency", id]))));
  if (!row || row.kind !== "local") return undefined;
  const files = documentFilesFor(tx);
  try {
    const bytes = await readFileDocumentState(files, owner.workbenchId, row);
    const epoch = decodeOrderedJson<{ epoch?: unknown } | null>(bytes)?.epoch;
    return databaseText(epoch) && epoch.length ? epoch : undefined;
  } catch (error) {
    // Only legacy bytes are read here. Missing, damaged and undecodable selectors expire.
    // Filesystem failures such as EACCES or EIO must leave the page intact for retry.
    const code = (error as NodeJS.ErrnoException).code;
    if (code && code !== "ENOENT" && code !== "ERR_ENCODING_INVALID_ENCODED_DATA") throw error;
    return undefined;
  }
};

type MarkerOwners = Map<number, StorageOwner & { id: number }>;
const copyEpochs = async (
  tx: OrderedTransaction,
  addresses: MarkerOwners,
  operationsByOwner: Map<number, string[]>,
) => {
  for (const [ownerId, ids] of operationsByOwner) {
    const needEpoch = await tx
      .select({ id: operations.operation_id })
      .from(operations)
      .where(
        and(
          eq(operations.owner_id, ownerId),
          inArray(operations.operation_id, ids),
          isNull(operations.settled_epoch),
          isNull(operations.receipt_epoch),
        ),
      );
    for (const { id } of needEpoch) {
      const epoch = await readLegacyEpoch(tx, addresses.get(ownerId)!, id);
      if (epoch !== undefined)
        await tx
          .update(operations)
          .set({ receipt_epoch: epoch })
          .where(and(eq(operations.owner_id, ownerId), eq(operations.operation_id, id)));
    }
  }
};
const retirePage = async (
  tx: OrderedTransaction,
  addresses: MarkerOwners,
  after: number,
  invalidate: () => Promise<void>,
) => {
  // Seek by the primary key alone. Released homes can lack statistics; filtering before
  // LIMIT lets Postgres sort the whole remaining marker population again on each batch.
  const page = await tx
    .select({
      id: documents.id,
      owner: documents.owner_id,
      key: sql<string | null>`CASE WHEN ${markerKey} THEN ${documents.key} END`,
    })
    .from(documents)
    .where(gt(documents.id, after))
    .orderBy(documents.id)
    .limit(64);
  if (!page.length) return;
  const last = page[page.length - 1]!.id;
  const documentsToDelete: number[] = [];
  const operationsByOwner = new Map<number, string[]>();
  for (const row of page) {
    if (!row.key) continue;
    const id = operationId(row.key);
    if (id === undefined) continue;
    const owner = addresses.get(row.owner);
    if (!owner) continue;
    trackDocumentFiles(tx, owner.workbenchId, row.id);
    documentsToDelete.push(row.id);
    if (!databaseText(id)) continue;
    const ids = operationsByOwner.get(row.owner) ?? [];
    ids.push(id);
    operationsByOwner.set(row.owner, ids);
  }
  if (!documentsToDelete.length) return last;
  await invalidate();

  await copyEpochs(tx, addresses, operationsByOwner);
  await tx.delete(documents).where(inArray(documents.id, documentsToDelete));
  return last;
};

/** Cursor advances only after commit. A restart rediscovers the surviving markers. */
export const createDependencyMarkerCleanup = (db: DbClient, beforeDelete: () => Promise<void>) => {
  let addresses: MarkerOwners | undefined;
  let invalidated = false;
  const invalidate = async () => {
    if (invalidated) return;
    await beforeDelete();
    invalidated = true;
  };
  let after = 0;
  let done = false;
  return async (stopped: () => boolean) => {
    if (done || stopped()) return;
    if (!addresses) {
      const affected = await db
        .select({ id: owners.id, workbenchId: owners.project_id, extensionId: owners.extension_id })
        .from(owners)
        .where(sql`EXISTS (SELECT 1 FROM ${documents} WHERE ${documents.owner_id}=${owners.id} AND ${markerKey})`);
      addresses = new Map(affected.map((owner) => [owner.id, owner]));
    }
    if (!addresses.size) {
      done = true;
      return;
    }
    while (!stopped()) {
      await Bun.sleep(0);
      if (stopped()) return;
      const cursor = await db.transaction((tx) => retirePage(tx, addresses!, after, invalidate));
      if (cursor === undefined) {
        done = true;
        return;
      }
      after = cursor;
    }
  };
};
