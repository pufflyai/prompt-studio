import { isDeepStrictEqual } from "node:util";
import { eq, getTableColumns, getTableName, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import {
  storage_ordered_operations,
  storage_ordered_receipts,
  storage_ordered_touches,
} from "./legacy-operation-schema";
import { storage_ordered_records } from "./legacy-record-row-schema";
import { storage_ordered_owners } from "./legacy-records-schema";
import { restoreOperationFacts } from "./operation-upgrade-values";
import { restoreRecordRows } from "./record-row-upgrade";
import { operations, owners } from "./schemas.pg";
import { decodeUpgradeBytes as decodeBytes } from "./upgrade-bytes";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

const sources = [
  {
    table: storage_ordered_owners,
    keys: [],
    bytes: ["receipt_root"],
    numbers: ["after", "through", "pending_bytes", "state_bytes"],
  },
  {
    table: storage_ordered_operations,
    keys: ["operation_id"],
    bytes: ["envelope", "admission"],
    numbers: ["local_sequence"],
  },
  { table: storage_ordered_records, keys: ["record_id"], bytes: ["state"], numbers: [] },
  { table: storage_ordered_touches, keys: ["record_id", "operation_id"], bytes: [], numbers: ["local_sequence"] },
  { table: storage_ordered_receipts, keys: ["epoch", "operation_id"], bytes: [], numbers: [] },
];

const safeNumber = (value: unknown) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("Invalid exported ordered storage position");
  return number;
};

type UpgradeTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const normalizedRow = async (
  tx: UpgradeTransaction,
  source: (typeof sources)[number],
  input: Record<string, unknown>,
  ownerIds: Map<string, number>,
) => {
  const { workbench_id, extension_id, ...row } = input;
  if (typeof workbench_id !== "string" || typeof extension_id !== "string")
    throw new Error("Invalid exported ordered storage owner");
  for (const column of source.bytes) if (row[column] !== null) row[column] = decodeBytes(row[column]);
  for (const column of source.numbers) row[column] = safeNumber(row[column]);
  const address = JSON.stringify([workbench_id, extension_id]);
  let ownerId = ownerIds.get(address);
  if (ownerId === undefined) {
    ownerId = await ensureStorageOwner(tx, { workbenchId: workbench_id, extensionId: extension_id });
    ownerIds.set(address, ownerId);
  }
  return { ...row, owner_id: ownerId } as Record<string, unknown>;
};
const restoreOwnerBatch = async (tx: UpgradeTransaction, batch: Record<string, unknown>[]) => {
  const defaults = {
    epoch: null,
    joined: false,
    after: 0,
    state_id: null,
    through: 0,
    pending_bytes: 0,
    state_bytes: 0,
    skipped: false,
    receipt_root: null,
  };
  for (const input of batch) {
    const { owner_id: id, ...expected } = await normalizedRow(tx, sources[0]!, input, new Map());
    const [current] = await tx
      .select()
      .from(owners)
      .where(eq(owners.id, id as number));
    if (!current) throw new Error("Missing restored ordered storage owner");
    const actual = Object.fromEntries(Object.keys(defaults).map((key) => [key, current[key as keyof typeof current]]));
    if (isDeepStrictEqual(actual, expected)) continue;
    if (!isDeepStrictEqual(actual, defaults)) throw new Error("Ordered storage restoration conflict: owners");
    await tx.update(owners).set(expected).where(eq(owners.id, current.id));
  }
};
const restoreBatch = async (
  tx: UpgradeTransaction,
  source: (typeof sources)[number],
  batch: Record<string, unknown>[],
) => {
  if (source.table === storage_ordered_owners) return restoreOwnerBatch(tx, batch);
  const table: PgTable = source.table === storage_ordered_operations ? operations : source.table;
  const columns = getTableColumns(table);
  const keys = ["owner_id", ...source.keys];
  const rowKey = (row: Record<string, unknown>) => JSON.stringify(keys.map((key) => row[key]));
  // Keys are valid only inside this transaction; deletion/recreation never reuses a cached owner.
  const ownerIds = new Map<string, number>();
  const expected = [];
  for (const row of batch) expected.push(await normalizedRow(tx, source, row, ownerIds));
  if (source.table === storage_ordered_touches || source.table === storage_ordered_receipts)
    return restoreOperationFacts(
      tx,
      getTableName(source.table) as "storage_ordered_touches" | "storage_ordered_receipts",
      expected,
    );
  if (source.table === storage_ordered_records) return restoreRecordRows(tx, "canonical", expected);
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
    else if (!isDeepStrictEqual(Object.fromEntries(Object.keys(row).map((key) => [key, previous[key]])), row))
      throw new Error(`Ordered storage restoration conflict: ${getTableName(table)}`);
  }
  if (missing.length) await tx.insert(table).values(missing);
};

/** Capture the entire FK graph before required integer keys replace released owner addresses. */
export const prepareOrderedOwnerUpgrade = async (db: DbClient, path: string) => {
  const {
    rows: [columns],
  } = await db.execute<{ legacy: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='storage_ordered_records' AND column_name='workbench_id') AS legacy`);
  let sequence: { lastValue: number; called: boolean } | undefined;
  const restoreSequence = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_ordered_operations_local_sequence_seq",
      keys: ["last_value"],
      name: "ordered-local-sequence",
      archive: "ordered-local-sequence",
      capture: columns!.legacy,
    },
    async (row) => {
      if (typeof row.is_called !== "boolean") throw new Error("Invalid exported operation sequence");
      sequence = { lastValue: safeNumber(row.last_value), called: row.is_called };
    },
  );
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
        keys: ["workbench_id", "extension_id", ...source.keys],
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
  // Retain the text-addressed parent as the conversion completion marker. Only
  // clear children after every input is fsynced; generated DDL rewires their FKs.
  if (columns!.legacy) for (const source of sources.slice(1).reverse()) await db.delete(source.table);
  if (!restorations.length && !restoreSequence) return;
  return async () => {
    for (const { restore, flush } of restorations) {
      await restore(true);
      await flush();
    }
    await restoreSequence?.(true);
    await db.execute(sql`SELECT setval(pg_get_serial_sequence('operations', 'local_sequence'),
      GREATEST(COALESCE((SELECT max(local_sequence) FROM operations),1),
        ${sequence?.lastValue ?? 1},(SELECT last_value FROM operations_local_sequence_seq)),
      ${sequence?.called ?? false} OR EXISTS (SELECT 1 FROM operations)
        OR (SELECT is_called FROM operations_local_sequence_seq))`);
    for (const { restore } of restorations) await restore.complete();
    await restoreSequence?.complete();
  };
};
