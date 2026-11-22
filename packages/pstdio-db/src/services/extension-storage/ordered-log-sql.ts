import { and, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { storage_log_streams as streams } from "../../db/schemas.pg";
import { ensureStorageOwner, storageOwnerKey } from "./storage-owner-key";

export type LogTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export interface LogPayloads {
  encode(value: unknown): Promise<Uint8Array>;
  decode<T>(bytes: Uint8Array): Promise<T>;
}
export interface OrderedLogAddress {
  owner: StorageOwner;
  name: string;
  scope: string;
  /** 'project' for shared relay order; device ID for independent device writers. */
  stream: string;
  writerId: string;
  keep?: { days: number };
  now?: () => number;
  changed?: () => void;
  payloads?: LogPayloads;
}
export const logAddress = (input: OrderedLogAddress) => ({
  owner_id: storageOwnerKey(input.owner),
  log_name: input.name,
  scope: input.scope,
  stream: input.stream,
});
// The cursor address is public and independent of this database's numeric keys.
export const logAddressKey = (input: OrderedLogAddress) =>
  JSON.stringify({
    workbench_id: input.owner.workbenchId,
    extension_id: input.owner.extensionId,
    log_name: input.name,
    scope: input.scope,
    stream: input.stream,
  });
export const logStreamKey = (input: OrderedLogAddress) =>
  sql<bigint>`(SELECT id FROM log_streams WHERE owner_id = ${storageOwnerKey(input.owner)}
    AND log_name = ${input.name} AND scope = ${input.scope} AND stream = ${input.stream})`;
export const logEntryAddress = (input: OrderedLogAddress) => ({ stream_id: logStreamKey(input) });
export const logWhere = (
  table: { stream_id: AnyPgColumn } | { [K in keyof ReturnType<typeof logAddress>]: AnyPgColumn },
  input: OrderedLogAddress,
) =>
  "stream_id" in table
    ? eq(table.stream_id, logStreamKey(input))
    : and(...Object.entries(logAddress(input)).map(([key, value]) => eq(table[key as keyof typeof table], value)));
export const logCutoff = (input: OrderedLogAddress) =>
  input.keep ? (input.now ?? Date.now)() - input.keep.days * 86_400_000 : 0;
export const lockLogStream = async (tx: LogTransaction, input: OrderedLogAddress) => {
  const ownerId = await ensureStorageOwner(tx, input.owner);
  await tx
    .insert(streams)
    .values({ ...logAddress(input), owner_id: ownerId })
    .onConflictDoNothing();
  const [stream] = await tx.select().from(streams).where(logWhere(streams, input)).for("update");
  return stream!;
};
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export const encodeLogValue = (value: unknown) => encoder.encode(JSON.stringify(value));
export const decodeLogValue = <T>(bytes: Uint8Array) => JSON.parse(decoder.decode(bytes)) as T;
export const encodeLogPayload = (input: OrderedLogAddress, value: unknown) =>
  input.payloads?.encode(value) ?? Promise.resolve(encodeLogValue(value));
export const decodeLogPayload = <T>(input: OrderedLogAddress, bytes: Uint8Array) =>
  input.payloads?.decode<T>(bytes) ?? Promise.resolve(decodeLogValue<T>(bytes));
