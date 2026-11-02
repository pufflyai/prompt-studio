import type { ReadResult, StateEnvelope, StateInfo, UpdateEnvelope, UpdateResult } from "pstdio-sync-contracts";
import type { SyncSpace } from "../encryption";
import type { AssetStore, DocumentStore, StorageOwner } from "../shared";

export interface DocumentRelay {
  read(after: number): Promise<ReadResult>;
  state(state: StateInfo): Promise<Uint8Array>;
  update(update: UpdateEnvelope): Promise<UpdateResult>;
  /** False means another device replaced the base state first. */
  replace(state: StateEnvelope): Promise<boolean>;
  blobs?: {
    put(blobId: string, bytes: Uint8Array): Promise<void>;
    get(blobId: string): Promise<Uint8Array>;
    read?(blobId: string, offset: number): Promise<ReadableStream<Uint8Array>>;
  };
}
export interface SyncFailure {
  reason?: "source-history";
  kind: "update" | "state";
  id: string;
  envelope: unknown;
}
export interface DocumentSyncInput {
  owner: StorageOwner;
  store: DocumentStore;
  space: SyncSpace;
  documentId: string;
  relay: DocumentRelay;
  assets?: AssetStore;
  quarantine(failure: SyncFailure): Promise<void>;
  limits?: { bytes: number; updates: number };
}

/** The relay's update frame is full; the client can publish the merged document as a latest state. */
export class DocumentUpdateTooLarge extends Error {}

/** A previously used blob has left relay storage after its grace period. */
export class DocumentBlobMissing extends Error {}
