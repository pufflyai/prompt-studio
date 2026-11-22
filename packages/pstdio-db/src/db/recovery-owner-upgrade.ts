import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { recovery_point_owners } from "./schemas.pg";
import { decodeUpgradeBytes as decodeBytes } from "./upgrade-bytes";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type ReleasedOwner = {
  workbench_id: string;
  extension_id: string;
  hours: number;
  revision: number;
  records: string;
  metadata: string;
};

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const normalizeOwner = async (tx: Transaction, input: ReleasedOwner, ownerIds: Map<string, number>) => {
  const { workbench_id, extension_id, records, metadata, ...row } = input;
  if (typeof workbench_id !== "string" || typeof extension_id !== "string")
    throw new Error("Invalid exported recovery owner");
  const address = JSON.stringify([workbench_id, extension_id]);
  let ownerId = ownerIds.get(address);
  if (ownerId === undefined) {
    ownerId = await ensureStorageOwner(tx, { workbenchId: workbench_id, extensionId: extension_id });
    ownerIds.set(address, ownerId);
  }
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision)) throw new Error("Invalid exported recovery revision");
  return {
    ...row,
    revision,
    project_id: workbench_id,
    owner_id: ownerId,
    records: decodeBytes(records),
    metadata: decodeBytes(metadata),
  };
};

/** Keep the saved recovery copies intact while their owner address becomes an integer FK. */
export const prepareRecoveryOwnerUpgrade = async (db: DbClient, path: string) => {
  const {
    rows: [columns],
  } = await db.execute<{ legacy: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='recovery_point_owners' AND column_name='extension_id') AS legacy`);
  const pending: ReleasedOwner[] = [];
  let pendingBytes = 0;
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    pendingBytes = 0;
    await db.transaction(async (tx) => {
      const ownerIds = new Map<string, number>();
      const expected = [];
      for (const input of batch) expected.push(await normalizeOwner(tx, input, ownerIds));
      const key = (row: { project_id: string; hours: number; owner_id: number }) =>
        JSON.stringify([row.project_id, row.hours, row.owner_id]);
      const existing = await tx
        .select()
        .from(recovery_point_owners)
        .where(sql`
        (${recovery_point_owners.project_id},${recovery_point_owners.hours},${recovery_point_owners.owner_id}) IN
        (${sql.join(
          expected.map((row) => sql`(${row.project_id},${row.hours},${row.owner_id})`),
          sql`, `,
        )})`);
      const retained = new Map(existing.map((row) => [key(row), row]));
      const missing = [];
      for (const row of expected) {
        const previous = retained.get(key(row));
        if (!previous) missing.push(row);
        else if (!isDeepStrictEqual(previous, row)) throw new Error("Recovery owner restoration conflict");
      }
      if (missing.length) await tx.insert(recovery_point_owners).values(missing);
    });
  };
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "recovery_point_owners",
      keys: ["workbench_id", "hours", "extension_id"],
      name: "recovery-owners",
      archive: "recovery-owners",
      capture: columns!.legacy,
    },
    async (input) => {
      const bytes = Buffer.byteLength(JSON.stringify(input));
      if (pending.length && pendingBytes + bytes > 4 * 1024 * 1024) await flush();
      pending.push(input as ReleasedOwner);
      pendingBytes += bytes;
      if (pending.length === 200) await flush();
    },
    async (input) => ({
      ...input,
      records: `\\x${Buffer.from(input.records as Uint8Array).toString("hex")}`,
      metadata: `\\x${Buffer.from(input.metadata as Uint8Array).toString("hex")}`,
    }),
  );
  // Durable input precedes the generated required FK and owner-column replacement.
  if (columns!.legacy) await db.delete(recovery_point_owners);
  if (!restore) return;
  return async () => {
    await restore(true);
    await flush();
    await restore.complete();
  };
};
