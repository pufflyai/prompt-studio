import { fingerprint, type Json, type StorageLogEntry } from "pstdio-sync-contracts";
import { type OrderedIndexReference, readOrderedIndexReference } from "../relay";

export interface LogWireEntry {
  id: string;
  writerId: string;
  createdAt: string;
  fingerprint: string;
  reference: OrderedIndexReference;
}
export const encodeLogWire = (entries: LogWireEntry[]) =>
  new TextEncoder().encode(JSON.stringify({ version: 1, format: "append-log", entries }));
export const decodeLogWire = (bytes: Uint8Array) => {
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (
    !value ||
    value.version !== 1 ||
    value.format !== "append-log" ||
    Object.keys(value).length !== 3 ||
    !Array.isArray(value.entries) ||
    !value.entries.length ||
    value.entries.length > 100
  )
    throw new Error("Invalid append-only log frame");
  const ids = new Set<string>();
  return value.entries.map((input: unknown) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid log entry metadata");
    const entry = input as LogWireEntry;
    if (
      Object.keys(entry).length !== 5 ||
      typeof entry.id !== "string" ||
      !entry.id ||
      typeof entry.writerId !== "string" ||
      !entry.writerId ||
      typeof entry.createdAt !== "string" ||
      !Number.isFinite(Date.parse(entry.createdAt)) ||
      typeof entry.fingerprint !== "string" ||
      !/^[a-f0-9]{64}$/u.test(entry.fingerprint) ||
      ids.has(entry.id)
    )
      throw new Error("Invalid log entry metadata");
    ids.add(entry.id);
    return {
      id: entry.id,
      writerId: entry.writerId,
      createdAt: entry.createdAt,
      fingerprint: entry.fingerprint,
      reference: readOrderedIndexReference(entry.reference),
    };
  }) as LogWireEntry[];
};
export const readLogPayload = async (input: unknown, expected: LogWireEntry) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid log entry payload");
  const entry = input as StorageLogEntry;
  if (
    Object.keys(entry).length !== 4 ||
    !Object.hasOwn(entry, "value") ||
    entry.id !== expected.id ||
    entry.writerId !== expected.writerId ||
    entry.createdAt !== expected.createdAt
  )
    throw new Error("Log entry payload differs from its authenticated metadata");
  if ((await fingerprint(entry as unknown as Json)) !== expected.fingerprint)
    throw new Error("Log entry fingerprint differs from its metadata");
  return entry;
};
