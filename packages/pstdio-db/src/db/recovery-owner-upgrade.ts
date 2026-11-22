import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import {
  prepareRecoveryBytes,
  type RecoveryReference,
  recoveryFilesFor,
} from "../services/extension-storage/recovery-files";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { recovery_point_owners } from "./schemas.pg";
import { decodeUpgradeBytes as decodeBytes } from "./upgrade-bytes";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type ReleasedOwner = {
  workbench_id?: string;
  extension_id?: string;
  project_id?: string;
  owner_id?: number;
  hours: number;
  revision: number | string;
  records: string;
  metadata: string;
};
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const normalizeOwner = async (
  tx: Transaction,
  input: ReleasedOwner,
  files: ReturnType<typeof recoveryFilesFor>,
  ownerIds: Map<string, number>,
  written: Map<string, RecoveryReference>,
) => {
  const projectId = input.project_id ?? input.workbench_id;
  if (typeof projectId !== "string") throw new Error("Invalid exported recovery project");
  let ownerId = input.owner_id;
  if (ownerId === undefined) {
    if (typeof input.extension_id !== "string") throw new Error("Invalid exported recovery owner");
    const address = JSON.stringify([projectId, input.extension_id]);
    ownerId = ownerIds.get(address);
    if (ownerId === undefined) {
      ownerId = await ensureStorageOwner(tx, { workbenchId: projectId, extensionId: input.extension_id });
      ownerIds.set(address, ownerId);
    }
  } else {
    const { rows } = await tx.execute(sql`SELECT id FROM owners WHERE id=${ownerId} AND project_id=${projectId}`);
    if (rows.length !== 1) throw new Error("Invalid exported recovery owner address");
  }
  const revision = Number(input.revision);
  if (!Number.isSafeInteger(revision)) throw new Error("Invalid exported recovery revision");
  const key = createHash("sha256")
    .update(JSON.stringify([projectId, input.hours, input.records, input.metadata]))
    .digest("hex");
  let reference = written.get(key);
  if (!reference) {
    reference = await files.put(
      projectId,
      input.hours,
      await prepareRecoveryBytes({ records: decodeBytes(input.records), metadata: decodeBytes(input.metadata) }),
    );
    written.set(key, reference);
  }
  return { project_id: projectId, hours: input.hours, owner_id: ownerId, revision, ...reference };
};

/** Preserve exact released payloads before their byte columns leave the schema. */
export const prepareRecoveryOwnerUpgrade = async (db: DbClient, path: string) => {
  const files = recoveryFilesFor(db, path);
  const {
    rows: [columns],
  } = await db.execute<{ legacy: boolean; bytes: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='recovery_point_owners' AND column_name='extension_id') AS legacy,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='recovery_point_owners' AND column_name='records') AS bytes`);
  const pending: ReleasedOwner[] = [];
  let pendingBytes = 0;
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    pendingBytes = 0;
    await db.transaction(async (tx) => {
      const ownerIds = new Map<string, number>();
      // Identical copies share a file. Reuse only within this bounded transaction:
      // collection cannot interleave, and every reused reference was already flushed.
      const written = new Map<string, RecoveryReference>();
      const expected = [];
      for (const input of batch) expected.push(await normalizeOwner(tx, input, files, ownerIds, written));
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
  let sourceHash = "";
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "recovery_point_owners",
      keys: columns!.legacy ? ["workbench_id", "hours", "extension_id"] : ["project_id", "hours", "owner_id"],
      name: "recovery-owners",
      archive: () => `recovery-owners-files-${sourceHash}`,
      capture: columns!.bytes,
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
  if (restore && path !== ":memory:") {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(`${path}-recovery-owners-upgrade.jsonl`)) hash.update(chunk);
    sourceHash = hash.digest("hex");
  }
  // Durable source precedes generated required columns, without a permanent placeholder default.
  if (columns!.bytes) await db.delete(recovery_point_owners);
  if (!restore) return;
  return async () => {
    await restore(true);
    await flush();
    await restore.complete();
  };
};
