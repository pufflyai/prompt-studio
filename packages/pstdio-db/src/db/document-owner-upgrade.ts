import { isDeepStrictEqual } from "node:util";
import { getTableColumns, getTableName, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { storage_resource_projections } from "./legacy-records-schema";
import { restoreNumberRevisions } from "./number-revision-upgrade";
import {
  storage_current_records,
  storage_document_operations,
  storage_document_updates,
  storage_documents,
  storage_resource_aliases,
  storage_resource_identities,
} from "./schemas.pg";
import { decodeUpgradeBytes as decodeBytes } from "./upgrade-bytes";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

const sources = [
  {
    table: storage_documents,
    owner: true,
    ownerKey: true,
    keys: ["document_id"],
    bytes: ["state"],
    numbers: ["revision", "folded_revision"],
  },
  {
    table: storage_document_updates,
    owner: true,
    ownerKey: true,
    keys: ["document_id", "revision"],
    bytes: ["update"],
    numbers: ["revision"],
  },
  {
    table: storage_document_operations,
    owner: true,
    ownerKey: true,
    keys: ["document_id", "operation_id"],
    bytes: [],
    numbers: [],
  },
  { table: storage_current_records, owner: true, ownerKey: true, keys: ["record_id"], bytes: [], numbers: [] },
  {
    table: storage_resource_projections,
    owner: true,
    ownerKey: false,
    keys: ["workbench_id"],
    bytes: [],
    numbers: ["revision"],
  },
  {
    table: storage_resource_identities,
    owner: false,
    ownerKey: false,
    keys: ["workbench_id", "resource_id"],
    bytes: [],
    numbers: ["value"],
  },
  {
    table: storage_resource_aliases,
    owner: false,
    ownerKey: false,
    keys: ["workbench_id", "resource_id", "shorthand"],
    bytes: [],
    numbers: ["value"],
  },
];
const safeNumber = (value: unknown) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("Invalid exported document storage position");
  return number;
};

type UpgradeTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const normalizedRow = async (
  tx: UpgradeTransaction,
  source: (typeof sources)[number],
  input: Record<string, unknown>,
  ownerIds: Map<string, number>,
) => {
  const { ...row } = input;
  for (const column of source.bytes) if (row[column] !== null) row[column] = decodeBytes(row[column]);
  for (const column of source.numbers) row[column] = safeNumber(row[column]);
  if (!source.owner) return row;
  const { workbench_id } = row;
  const extension_id = row.extension_id ?? "pstdio";
  if (source.table !== storage_resource_projections) delete row.workbench_id;
  delete row.extension_id;
  if (typeof workbench_id !== "string" || typeof extension_id !== "string")
    throw new Error("Invalid exported document storage owner");
  const address = JSON.stringify([workbench_id, extension_id]);
  let ownerId = ownerIds.get(address);
  if (ownerId === undefined) {
    ownerId = await ensureStorageOwner(tx, { workbenchId: workbench_id, extensionId: extension_id });
    ownerIds.set(address, ownerId);
  }
  return { ...row, owner_id: ownerId } as Record<string, unknown>;
};
const restoreBatch = async (
  tx: UpgradeTransaction,
  source: (typeof sources)[number],
  batch: Record<string, unknown>[],
) => {
  if (source.table === storage_resource_projections) return restoreNumberRevisions(tx, batch);
  const table: PgTable = source.table;
  const columns = getTableColumns(table);
  const keys = source.ownerKey ? ["owner_id", ...source.keys] : source.keys;
  const rowKey = (row: Record<string, unknown>) => JSON.stringify(keys.map((key) => row[key]));
  // Keys are valid only inside this transaction; deletion/recreation never reuses a cached owner.
  const ownerIds = new Map<string, number>();
  const expected = [];
  for (const row of batch) expected.push(await normalizedRow(tx, source, row, ownerIds));
  const tuple = (values: unknown[]) =>
    sql`(${sql.join(
      values.map((value) => sql`${value}`),
      sql`, `,
    )})`;
  const existing = await tx
    .select()
    .from(table)
    .where(sql`
    (${sql.join(
      keys.map((key) => columns[key]!),
      sql`, `,
    )}) IN
      (${sql.join(
        expected.map((row) => tuple(keys.map((key) => row[key]))),
        sql`, `,
      )})`);
  const retained = new Map(existing.map((row) => [rowKey(row), row]));
  const missing = [];
  for (const row of expected) {
    const previous = retained.get(rowKey(row));
    if (!previous) missing.push(row);
    else if (!isDeepStrictEqual(previous, row))
      throw new Error(`Document storage restoration conflict: ${getTableName(table)}`);
  }
  if (missing.length) await tx.insert(table).values(missing);
};

/** Capture the entire FK graph before required integer keys replace released owner addresses. */
export const prepareDocumentOwnerUpgrade = async (db: DbClient, path: string) => {
  const {
    rows: [columns],
  } = await db.execute<{ legacy: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='storage_documents' AND column_name='workbench_id') AS legacy`);
  const restorations: {
    restore: NonNullable<Awaited<ReturnType<typeof prepareUpgradeSnapshot>>>;
    flush: () => Promise<void>;
  }[] = [];
  for (const source of sources) {
    const name = getTableName(source.table);
    const pending: Record<string, unknown>[] = [];
    let pendingBytes = 0;
    const flush = async () => {
      if (!pending.length) return;
      const batch = pending.splice(0);
      pendingBytes = 0;
      await db.transaction((tx) => restoreBatch(tx, source, batch));
    };
    const restore = await prepareUpgradeSnapshot(
      db,
      path,
      {
        table: name,
        keys: source.ownerKey ? ["workbench_id", "extension_id", ...source.keys] : source.keys,
        name: `${name}-owners`,
        archive: name,
        capture: columns!.legacy,
      },
      async (row) => {
        const bytes = Buffer.byteLength(JSON.stringify(row));
        if (pending.length && pendingBytes + bytes > 4 * 1024 * 1024) await flush();
        pending.push(row);
        pendingBytes += bytes;
        if (pending.length === 200) await flush();
      },
      async (input) => {
        const row = { ...input };
        for (const column of source.bytes)
          if (row[column] !== null) row[column] = `\\x${Buffer.from(row[column] as Uint8Array).toString("hex")}`;
        return row;
      },
    );
    if (restore) restorations.push({ restore, flush });
  }
  // All document inputs and the separately captured owner positions must be durable before document deletion cascades to derived identities.
  // Drop generated query triggers while their released columns still exist.
  if (columns!.legacy) {
    await db.delete(storage_documents);
  }
  if (!restorations.length) return;
  return async () => {
    for (const { restore, flush } of restorations) {
      await restore(true);
      await flush();
    }
    for (const { restore } of restorations) await restore.complete();
  };
};
