import type { Asset } from "pstdio-sync-contracts";
import type { SyncSpace } from "../encryption";
import type { AssetStore } from "../shared";
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
  /** That latest state's encrypted size, from its summary. */
  stateBytes: number;
  /**
   * True after this device left out a frame or record the stream holds. Every sequence it skipped is
   * at most `after`, so loading a later latest state, or founding a new stream, clears it.
   */
  skipped: boolean;
}

/** One record's Yjs bytes, as stored in an outbox entry or a snapshot. */
export interface RecordBytes {
  recordId: string;
  bytes: Uint8Array;
}

/** A device's durable record storage, as the record stream needs it. Every method is atomic. */
export interface RecordStreamStore {
  /** Starts keeping local saves for upload and returns the saved cursor. */
  open(): Promise<RecordStreamCursor>;
  /**
   * Applies downloaded frames and saves the cursor in one transaction. Null frames were unreadable.
   * A frame with a record that cannot be merged is skipped whole (R4); returns those frames' indexes
   * and the saved cursor, marked `skipped` when any frame was left out.
   */
  apply(
    frames: (RecordFrame | null)[],
    cursor: RecordStreamCursor,
  ): Promise<{ rejected: number[]; cursor: RecordStreamCursor }>;
  /**
   * Merges records from the relay. `adopt` replaces each record's own history with the synced one and
   * reapplies this device's changes; `repair` merges a latest state and queues what it lacks (R19).
   * Returns the records it could not merge and the saved cursor, marked `skipped` when there were any.
   */
  merge(
    remote: Map<string, Uint8Array[]>,
    mode: "adopt" | "repair",
    cursor: RecordStreamCursor,
  ): Promise<{ rejected: string[]; cursor: RecordStreamCursor }>;
  /** Saved local changes not on the relay yet, oldest first, within `limit` bytes but at least one entry. */
  outbox(limit: number): Promise<{ sequence: number; records: RecordBytes[]; assets: Asset[] }[]>;
  /** Drops outbox entries up to `sequence` once the relay holds them. */
  sent(sequence: number): Promise<void>;
  /**
   * Every record's full state and current file at one moment, and the newest outbox entry those
   * states include. Read together, so a latest state never lists a file its records do not use.
   */
  snapshot(): Promise<{ records: RecordBytes[]; assets: Map<string, Asset>; outbox: number }>;
  /** Saves the cursor after a latest-state upload and drops the outbox entries it covered. */
  published(cursor: RecordStreamCursor, outbox: number): Promise<void>;
  hasRecords(): Promise<boolean>;
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
