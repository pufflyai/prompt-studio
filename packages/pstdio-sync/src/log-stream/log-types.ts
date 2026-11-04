import type { StorageLogEntry, StorageLogPage, StorageLogRead, UpdateEnvelope } from "pstdio-sync-contracts";
import type { SyncSpace } from "../encryption";
import type { OrderedIndexBlobs } from "../records";
import type { DocumentRelay } from "../relay";

export interface LogSyncInput {
  space: SyncSpace;
  documentId: string;
  relay: DocumentRelay;
  store: LogStreamStore;
  manifestBlobs?: () => Promise<OrderedIndexBlobs>;
  /** Device streams restrict snapshots and relay-loss founding to their writer. */
  canCompact?: boolean;
}

export interface LogReceivedBatch {
  sequence: number;
  /** Null positions are unrequested/expired payloads; preserving indices keeps cursors portable. */
  entries: (StorageLogEntry | null)[];
  /** Count of unexpired entries in the authenticated batch metadata. */
  retainedCount?: number;
  expected?: { id: string; fingerprint: string }[];
  /** Authenticated index traversal proves the intervening prefix has no retained entries. */
  skipBefore?: number;
}
export interface LogDelivery {
  envelope: UpdateEnvelope;
  /** Exact encrypted leaves survive a failed upload or lost ACK. */
  blobs: { blobId: string; bytes: string; children: string[] }[];
}
/** Payload-free identity and the exact per-stream position after displaying this entry. */
export interface LogEntryMetadata {
  id: string;
  writerId: string;
  createdAt: string;
  cursor: string;
}
export interface LogKnownEntry {
  id: string;
  writerId: string;
  createdAt: string;
  sequence: number | null;
  index: number | null;
  localSequence: number;
  local: boolean;
}
export interface LogReadPlan {
  entries: LogEntryMetadata[];
  cursor: string;
  more: boolean;
  /** Only identities selected from this authenticated metadata plan can open their payloads. */
  materialize(ids: readonly string[]): Promise<StorageLogEntry[]>;
}
export interface LogStreamStore {
  address: string;
  cutoff(): number;
  append(value: StorageLogEntry["value"], options?: { id?: string }): Promise<StorageLogEntry>;
  read(options?: StorageLogRead): Promise<StorageLogPage>;
  plan?(options?: StorageLogRead): Promise<LogReadPlan>;
  lookupMetadata?(ids: readonly string[]): Promise<LogKnownEntry[]>;
  pending(limit: number, through?: number): Promise<{ entry: StorageLogEntry; delivery?: LogDelivery }[]>;
  pendingThrough(): Promise<number>;
  prepare(id: string, delivery: LogDelivery): Promise<LogDelivery>;
  receive(
    batches: LogReceivedBatch[],
    head: number,
    options?: { from?: number; skipTo?: number; stateId?: string; through?: number },
  ): Promise<void>;
  status(): Promise<{ head: number; completeThrough: number; stateId: string | null; through: number }>;
  snapshotPage(
    after: { sequence: number; index: number },
    limit: number,
  ): Promise<{ sequence: number; index: number; entry: StorageLogEntry }[]>;
  watch(listener: () => void): () => unknown;
}
