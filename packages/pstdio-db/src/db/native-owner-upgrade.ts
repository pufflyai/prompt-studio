import { getTableName, sql } from "drizzle-orm";
import { documentFilesFor } from "../services/extension-storage/document-files";
import type { DbClient } from "./connection.pglite";
import { restoreNativeFileBatch } from "./native-file-upgrade";
import {
  native_document_file_projections,
  native_document_room_updates,
  native_document_rooms,
  native_document_sources,
} from "./schemas/native-documents";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

const sources = [
  { table: native_document_sources, owner: true, ownerKey: true, keys: ["document_key"], bytes: [], numbers: [] },
  {
    table: native_document_rooms,
    owner: true,
    ownerKey: false,
    keys: ["id"],
    bytes: ["state"],
    numbers: ["revision", "folded_revision"],
  },
  {
    table: native_document_room_updates,
    owner: false,
    ownerKey: false,
    keys: ["room_id", "revision"],
    bytes: ["update"],
    numbers: ["revision"],
  },
  {
    table: native_document_file_projections,
    owner: true,
    ownerKey: true,
    keys: ["document_key", "projection_key"],
    bytes: ["baseline", "pending"],
    numbers: ["completed_revision"],
  },
];
/** Capture the entire FK graph before required integer keys replace released owner addresses. */
export const prepareNativeOwnerUpgrade = async (db: DbClient, path: string) => {
  documentFilesFor(db, path);
  const {
    rows: [columns],
  } = await db.execute<{ legacy: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='native_document_sources' AND column_name='workbench_id') AS legacy`);
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
      await db.transaction((tx) => restoreNativeFileBatch(tx, name, batch));
    };
    const restore = await prepareUpgradeSnapshot(
      db,
      path,
      {
        table: name,
        keys: source.owner ? ["workbench_id", "extension_id", ...source.keys] : source.keys,
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
  // Evacuate only after the entire source/room/update graph and file intents are fsynced.
  if (columns!.legacy) {
    await db.delete(native_document_sources);
    await db.delete(native_document_file_projections);
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
