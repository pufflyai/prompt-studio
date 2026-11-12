import type { Asset } from "pstdio-sync-contracts";
import type { RecordBytes } from "./record-stream-types";

export interface SyncFileTransfer {
  id: string;
  name?: string;
  direction: "upload" | "download";
  status: "queued" | "active" | "completed" | "failed";
  /** Original file size. Transfer counters describe encrypted network bytes. */
  byteLength: number;
  completedBytes: number;
  totalBytes: number;
}
export type FileProgress = (transfer: SyncFileTransfer) => void;

const editMetadata = (edit: { changes: { path: string[]; set?: unknown }[] }) => {
  let asset: Asset | undefined;
  let value: Record<string, unknown> = {};
  for (const change of edit.changes) {
    if (change.path.length === 1 && change.path[0] === "asset") asset = change.set as Asset | undefined;
    if (change.path.length === 1 && change.path[0] === "value") value = (change.set ?? {}) as Record<string, unknown>;
    if (change.path.length === 2 && change.path[0] === "value") value[change.path[1]] = change.set;
  }
  return { asset, value };
};

/** Only known file metadata is exposed. Internal record IDs are never invented file names. */
export const recordAssetNames = (records: RecordBytes[], format?: "ordered") => {
  const names = new Map<string, string>();
  if (!format) return names;
  const remember = (asset: Asset | undefined, value: Record<string, unknown> | undefined) => {
    const name = value?.path ?? value?.fileName ?? value?.name;
    if (asset?.sha256 && typeof name === "string") names.set(asset.sha256, name);
  };
  for (const { bytes } of records) {
    const entry = JSON.parse(new TextDecoder().decode(bytes));
    if (entry.type === "record") remember(entry.record.value?.asset, entry.record.value?.value);
    if (entry.type === "admission") {
      for (const edit of entry.admission.operation.edits) {
        const { asset, value } = editMetadata(edit);
        remember(asset, value);
      }
    }
  }
  return names;
};
