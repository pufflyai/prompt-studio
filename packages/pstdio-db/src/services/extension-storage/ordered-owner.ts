import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { assertStorageOwnerAdmitted } from "../../db/storage-admission";
import { ensureStorageOwner } from "./storage-owner-key";

/** New runtime owners have no historical format to convert. */
export const ensureOrderedOwner = async (db: DbClient, owner: StorageOwner) => {
  assertStorageOwnerAdmitted(db, owner);
  await ensureStorageOwner(db, owner);
};
