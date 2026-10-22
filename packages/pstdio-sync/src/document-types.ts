import type { StorageRecordQueries } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import { applyDocumentBinaryUpdate } from "./document-binary";
import type { DocumentHistory } from "./document-history";
import { trackDocumentPayload } from "./document-payload";
import type { StorageObserver, StorageOwner } from "./types";

export interface DocumentState {
  document: Y.Doc;
  revision?: number;
  /** Persist accepted bytes even when Yjs is waiting for a causal predecessor. */
  applyUpdate?(update: Uint8Array): void;
  migrationSeed?: string;
  migrationHistory?: DocumentHistory;
  operation(id: string): Promise<string | undefined>;
  remember(id: string, fingerprint: string): void;
  /** Explicit install/upgrade work. Never called by a query or a cache miss. */
  rebuildProjection?: () => Promise<void>;
}

export const applyDocumentUpdate = (state: DocumentState, update: Uint8Array) => {
  if (state.applyUpdate) state.applyUpdate(update);
  else applyDocumentBinaryUpdate(state.document, update);
};
export interface DocumentStore {
  queries?: (owner: StorageOwner) => StorageRecordQueries;
  observer?: StorageObserver;
  /** A consistent persisted checkpoint and tail, without hydrating a document. */
  snapshot?(owner: StorageOwner, knownRevision?: number): Promise<{ revision: number; updates: Uint8Array[] }>;
  revision?(owner: StorageOwner): Promise<number>;
  receive?(owner: StorageOwner, revision: number, update: Uint8Array, signal?: AbortSignal): Promise<boolean>;
  transaction<T>(owner: StorageOwner, action: (state: DocumentState) => Promise<T>): Promise<T>;
}

export const hasDocumentUserData = (document: Y.Doc) =>
  document.getMap("records").size > 0 || document.getMap("deleted").size > 0 || document.getText("content").length > 0;

export const memoryDocumentState = (document: Y.Doc) => {
  trackDocumentPayload(document);
  const operations = new Map<string, string>();
  return {
    document,
    operation: async (id: string) => operations.get(id),
    remember: (id: string, fingerprint: string) => {
      operations.set(id, fingerprint);
    },
  } satisfies DocumentState;
};
