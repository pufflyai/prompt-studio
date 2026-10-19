import type { SyncOutcome } from "./state";
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
export interface ResolutionInput {
  conflictId: string;
  expectedConflicts: { conflictId: string; revision: number }[];
  capturedOperationIds: string[];
  expectedInputs: { recordId: string; revision: number }[];
  handler?: { publishedRevision: string; handlerId: string };
}

export interface StorageRecord {
  recordId: string;
  /** True after the first saved change, including a retained tombstone. */
  exists: boolean;
  /** Opaque caller-observed revision. Pass it back unchanged when saving. */
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
  edits: (RecordEdit & { expectedRevision: string })[];
}

export interface StorageResolution {
  operationId: string;
  conflictId: string;
  expectedConflicts: { conflictId: string; revision: number }[];
  capturedOperationIds: string[];
  expectedInputs: { recordId: string; revision: string }[];
  choose: "local" | "remote";
  /** Optional domain merge. Must cover every captured record exactly once. */
  edits?: RecordEdit[];
  handler?: { publishedRevision: string; handlerId: string };
}

export interface StorageConflict {
  conflictId: string;
  revision: number;
  reason: string;
  recordIds: string[];
  alternativeOperationIds: string[];
}

export interface StorageConflictInspection {
  conflictId: string;
  revision: number;
  expectedConflicts: { conflictId: string; revision: number }[];
  capturedOperationIds: string[];
  expectedInputs: { recordId: string; revision: string }[];
  accepted: StorageRecord[];
  alternatives: { operationId: string; parents: string[]; records: StorageRecord[] }[];
}

export type StorageSaveOutcome = SyncOutcome;
