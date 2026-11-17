import type { Asset } from "pstdio-sync-contracts";
import type { SyncSpace } from "../encryption";
import type { AssetStore } from "../shared";
import type { DocumentRelay, SyncFailure } from "./document-sync-types";
import type { OrderedIndexReference } from "./ordered-receipt-index-blobs";
import type { AssetReferences } from "./record-assets";
import type { RecordFrame } from "./record-frames";
import type { FileProgress } from "./transfer-progress";

/** What a device has read from its owner's record stream. Saved with the records it describes. */
export interface RecordStreamCursor {
  /** Ordered summary roots advance atomically only after their covered history is applied. */
  receiptRoot?: OrderedIndexReference | null;
  receiptStateId?: string | null;
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

/** One encoded record entry, as stored in an outbox entry or a snapshot. */
export interface RecordBytes {
  recordId: string;
  bytes: Uint8Array;
}

/** A device's durable record storage, as the record stream needs it. Every method is atomic. */
export interface RecordStreamStore {
  /** Ordered client payloads are incompatible with legacy Yjs record frames. */
  recordFormat?: "ordered";
  connect?(space: SyncSpace, relay: DocumentRelay): Promise<void>;
  checkpointPending?(): Promise<boolean>;
  /** False when a latest state's receipt root holds decisions this device has not applied. */
  coversReceipts?(root: OrderedIndexReference | null): Promise<boolean>;
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
   * Repair validates retained tail saves whole against local and snapshot records before comparing
   * missing edits. Returns rejected records and tail frame indexes; either marks the cursor skipped.
   */
  merge(
    remote: Map<string, Uint8Array[]>,
    mode: "adopt" | "repair",
    cursor: RecordStreamCursor,
    tail?: (RecordFrame | null)[],
  ): Promise<{ rejected: string[]; rejectedFrames: number[]; cursor: RecordStreamCursor }>;
  /** Saved local changes not on the relay yet, oldest first, within `limit` bytes but at least one entry. */
  outbox(limit: number): Promise<{ sequence: number; records: RecordBytes[]; assets: Asset[] }[]>;
  /** Legacy stores drop the delivered prefix; ordered stores mark exactly the included sequences.
   * Delivery never settles an ordered save without its exact decision. */
  sent(sequence: number, included?: number[]): Promise<void>;
  /**
   * Every record's full state and current file at one moment, and the newest outbox entry those
   * states include. Read together, so a latest state never lists a file its records do not use.
   */
  snapshot(options?: {
    found: boolean;
    /** Set only after Sync observes an actually empty or lost relay stream. */
    relayEmpty?: boolean;
  }): Promise<{
    records: RecordBytes[];
    assets: Map<string, Asset>;
    outbox: number;
    blobIds?: string[];
    receiptRoot?: OrderedIndexReference | null;
  }>;
  /** Saves the cursor after a latest-state upload and drops the outbox entries it covered. */
  published(cursor: RecordStreamCursor, outbox: number): Promise<RecordStreamCursor> | Promise<void>;
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
  fileProgress?: FileProgress;
}
