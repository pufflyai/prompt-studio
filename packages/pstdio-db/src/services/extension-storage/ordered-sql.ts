import { and, eq } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { storageOwnerKey } from "./storage-owner-key";

export type OrderedTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
// JSON escapes NUL and lone surrogates before UTF-8, unlike storing arbitrary values directly in JSONB.
export const encodeOrderedJson = (value: unknown) => encoder.encode(JSON.stringify(value));
export const decodeOrderedJson = <T>(bytes: Uint8Array) => JSON.parse(decoder.decode(bytes)) as T;
export const orderedOwnerWhere = (
  table: { owner_id: AnyPgColumn } | { workbench_id: AnyPgColumn; extension_id: AnyPgColumn },
  owner: StorageOwner,
) =>
  "owner_id" in table
    ? eq(table.owner_id, storageOwnerKey(owner))
    : and(eq(table.workbench_id, owner.workbenchId), eq(table.extension_id, owner.extensionId));
export const orderedAddress = (owner: StorageOwner) => ({ owner_id: storageOwnerKey(owner) });
