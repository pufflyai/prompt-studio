import type { Asset, Json } from "./wire";

// Design inputs for the SDK child, deliberately separate from wire envelopes.
// These are not added to @pstdio/sdk until the storage implementation owns them.
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
