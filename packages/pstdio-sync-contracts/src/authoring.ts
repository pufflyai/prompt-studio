import type { Checkpoint } from "./state";
import type { Asset, Json } from "./wire";

// Author inputs stay separate from wire envelopes and internal shared-document bytes.
export type SharedEdit =
  | { kind: "text.insert"; index: number; text: string }
  | { kind: "text.delete"; index: number; count: number }
  | { kind: "list.insert"; index: number; values: Json[] }
  | { kind: "list.delete"; index: number; count: number }
  | { kind: "map.set"; key: string; value: Json }
  | { kind: "map.delete"; key: string };
export interface RecordEdit {
  recordId: string;
  shared?: SharedEdit[];
  replace?: Json;
  asset?: Asset | null;
  deleted?: boolean;
}

export interface StorageRecord {
  recordId: string;
  /** True after the first saved change, including a retained tombstone. */
  exists: boolean;
  /** Opaque caller-observed revision. Pass it back unchanged as `expectedRevision`, or omit it to edit the current value. */
  revision: string;
  value: Json;
  asset: Asset | null;
  deleted: boolean;
  shared:
    | { kind: "text"; value: string }
    | { kind: "list"; value: Json[] }
    | { kind: "map"; value: Record<string, Json> }
    | null;
}

export interface StorageGroup {
  operationId: string;
  /** `expectedRevision` is optional. Without it, the edit applies to the record's current value. */
  edits: (RecordEdit & { expectedRevision?: string })[];
}

/** @deprecated Conflicts go away because edits merge. Remove calls to `records.resolve`. */
export interface StorageResolution {
  operationId: string;
  conflictId: string;
  expectedConflicts: { conflictId: string; revision: number }[];
  capturedOperationIds: string[];
  expectedInputs: { recordId: string; revision: string }[];
  choose: "local" | "remote";
  handler?: { publishedRevision: string; handlerId: string };
}

/** @deprecated Conflicts go away because edits merge. Remove calls to `records.conflicts`. */
export interface StorageConflict {
  conflictId: string;
  revision: number;
  reason: string;
  recordIds: string[];
  alternativeOperationIds: string[];
}

/** @deprecated Conflicts go away because edits merge. Remove calls to `records.inspect`. */
export interface StorageConflictInspection {
  conflictId: string;
  revision: number;
  expectedConflicts: { conflictId: string; revision: number }[];
  capturedOperationIds: string[];
  expectedInputs: { recordId: string; revision: string }[];
  accepted: StorageRecord[];
  alternatives: { operationId: string; parents: string[]; records: StorageRecord[] }[];
}

/** Sync state of a save: saved locally, waiting to sync, synced, offline, or a problem that needs attention. */
export type StorageSaveState = "saved-locally" | "waiting-to-sync" | "synced" | "offline" | "needs-attention";

/** Result of a save. Read `state`. The next breaking release removes `status` and its relay fields. */
export type StorageSaveOutcome = {
  operationId: string;
  state: StorageSaveState;
  /** Explains why a save is waiting to sync. */
  reason?: string;
} & (
  | { /** @deprecated Read `state`. */ status: "saved-locally" }
  | { /** @deprecated Read `state`. */ status: "pending"; reason: string }
  | {
      /** @deprecated Read `state`. */
      status: "synchronized";
      /** @deprecated Relay checkpoints are removed. `state: "synced"` reports relay acceptance. */
      checkpoint: Checkpoint;
    }
  | {
      /** @deprecated Read `state`. Conflicts go away because edits merge. */
      status: "conflict";
      /** @deprecated Conflicts go away because edits merge. */
      conflictId: string;
      /** @deprecated Conflicts go away because edits merge. */
      conflictRevision: number;
    }
);
