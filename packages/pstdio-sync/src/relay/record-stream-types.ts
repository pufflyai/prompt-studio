import type { Asset } from "pstdio-sync-contracts";
import type { SyncSpace } from "../encryption";
import type { AssetStore } from "../types";
import type { DocumentRelay, SyncFailure } from "./document-sync-types";
import type { AssetReferences } from "./record-assets";
import type { RecordFrame } from "./record-frames";

/** What a device has read from its owner's record stream. Saved with the records it describes. */
export interface RecordStreamCursor {
  /** False until this device's records share one history with the stream (it published or adopted). */
  joined: boolean;
  /** The last relay sequence applied here. */
  after: number;
  /** The relay's latest state when this device last read, the base of its next upload. */
  stateId: string | null;
  through: number;
  /** Update bytes after that state, for the latest-state upload trigger (R18). */
  pendingBytes: number;
}

/** One record's Yjs bytes, as stored in an outbox entry or a snapshot. */
export interface RecordBytes {
  recordId: string;
  bytes: Uint8Array;
}

/** A device's durable record storage, as the record stream needs it. Every method is atomic. */
export interface RecordStreamStore {
  /** Starts keeping local saves for upload. A changed key generation starts the stream over. */
  open(generation: number): Promise<RecordStreamCursor>;
  /**
   * Applies downloaded frames and saves the cursor in one transaction. Null frames were unreadable.
   * Returns the records whose bytes could not be merged; they are skipped.
   */
  apply(frames: (RecordFrame | null)[], cursor: RecordStreamCursor): Promise<string[]>;
  /**
   * Merges records from the relay. `adopt` replaces each record's own history with the synced one and
   * reapplies this device's changes; `repair` merges a latest state and queues what it lacks (R19).
   */
  merge(remote: Map<string, Uint8Array[]>, mode: "adopt" | "repair", cursor: RecordStreamCursor): Promise<string[]>;
  /** Saved local changes not on the relay yet, oldest first, within `limit` bytes but at least one entry. */
  outbox(limit: number): Promise<{ sequence: number; records: RecordBytes[] }[]>;
  /** Drops outbox entries up to `sequence` once the relay holds them. */
  sent(sequence: number): Promise<void>;
  /** Every record's full state at one moment, and the newest outbox entry those states include. */
  snapshot(): Promise<{ records: RecordBytes[]; outbox: number }>;
  /** Saves the cursor after a latest-state upload and drops the outbox entries it covered. */
  published(cursor: RecordStreamCursor, outbox: number): Promise<void>;
  hasRecords(): Promise<boolean>;
  /** The current assets of these records. */
  assets(recordIds: string[]): Promise<Asset[]>;
  /** True while saved local changes wait for upload. */
  pending(): Promise<boolean>;
  references: AssetReferences;
}

export interface RecordStreamInput {
  space: SyncSpace;
  documentId: string;
  relay: DocumentRelay;
  store: RecordStreamStore;
  assets?: AssetStore;
  quarantine(failure: SyncFailure): Promise<void>;
  limits?: { bytes: number; updates: number };
}
