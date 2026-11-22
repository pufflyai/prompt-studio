import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { orderedNativeAddress } from "./ordered-native-source";
import { ensureOrderedOwner } from "./ordered-owner";
import { lockRecordOwner } from "./record-changes";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/** Call while holding the record owner lock; initial independent histories share their original key. */
export const nativeSourceAddressIn = async (
  tx: Transaction,
  owner: StorageOwner,
  input: { recordId: string; documentKey: string; field?: string },
) => orderedNativeAddress(tx, owner, input);

export const resolveNativeRecordAddress = async (
  db: DbClient,
  owner: StorageOwner,
  input: { recordId: string; documentKey: string; field?: string },
) => {
  await ensureOrderedOwner(db, owner);
  return db.transaction(async (tx) => {
    await lockRecordOwner(tx, owner);
    return nativeSourceAddressIn(tx, owner, input);
  });
};
