import type { StorageRecord } from "./authoring";

/**
 * Records hold small structured data. Large content belongs in files, which keep only
 * metadata in the database. One commit stays within what one write statement can carry.
 */
export const storageLimits = {
  /** Largest encoded JSON of one record's value and shared state. */
  recordBytes: 256 * 1024,
  /** Largest encoded JSON of all records that one commit writes. */
  commitBytes: 4 * 1024 * 1024,
} as const;

/** A save that the host refused because it was over a storage limit. Nothing in the save was written. */
export interface StorageLimitError extends Error {
  code: "storage_limit_exceeded";
  data: {
    limit: "record" | "commit";
    /** The record over the limit. Missing when the whole commit is over the limit. */
    recordId?: string;
    bytes: number;
    maxBytes: number;
  };
}

/** Works across bundles and across the webview boundary, without a shared Error class. */
export const isStorageLimitError = (error: unknown): error is StorageLimitError =>
  error instanceof Error && "code" in error && error.code === "storage_limit_exceeded";

const encoder = new TextEncoder();

/** UTF-8 bytes of the record's value and shared state as JSON. Asset metadata does not count. */
export const storageRecordBytes = (record: Pick<StorageRecord, "value" | "shared">) =>
  encoder.encode(JSON.stringify({ value: record.value, shared: record.shared })).length;

const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
const mib = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
const instead =
  "Store large content as a file with ctx.storage.files, ctx.extensionFiles, or an artifact mount, and keep only its ID or path in the record.";

const limitError = (message: string, data: StorageLimitError["data"]) =>
  Object.assign(new Error(message), { name: "StorageLimitError", code: "storage_limit_exceeded" as const, data });

/** Refuses saved records over the record limit, and a commit whose records together are over the commit limit. */
export const assertStorageLimits = (records: Pick<StorageRecord, "recordId" | "value" | "shared" | "deleted">[]) => {
  let total = 0;
  for (const record of records) {
    if (record.deleted) continue;
    const bytes = storageRecordBytes(record);
    if (bytes > storageLimits.recordBytes)
      throw limitError(
        `Storage record "${record.recordId}" is ${kib(bytes)}, over the ${kib(storageLimits.recordBytes)} limit for one record. ${instead}`,
        { limit: "record", recordId: record.recordId, bytes, maxBytes: storageLimits.recordBytes },
      );
    total += bytes;
  }
  if (total > storageLimits.commitBytes)
    throw limitError(
      `This save writes ${mib(total)} of records, over the ${mib(storageLimits.commitBytes)} limit for one commit. ${instead} Save independent records in separate commits.`,
      { limit: "commit", bytes: total, maxBytes: storageLimits.commitBytes },
    );
};
