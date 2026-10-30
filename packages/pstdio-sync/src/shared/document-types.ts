import type { StorageRecordQueries } from "pstdio-sync-contracts";
import * as Y from "yjs";
import type { DocumentHistory } from "./document-history";
import type { StorageObserver, StorageOwner } from "./types";

export interface DocumentState {
  document: Y.Doc;
  migrationSeed?: string;
  migrationHistory?: DocumentHistory;
  operation(id: string): Promise<string | undefined>;
  remember(id: string, fingerprint: string): void;
}
export interface DocumentStore {
  queries?: (owner: StorageOwner) => StorageRecordQueries;
  observer?: StorageObserver;
  /** Standalone seeded text adopts one genesis before publishing unrelated local history. */
  initialHistory?: {
    validate(document: Y.Doc): Promise<unknown>;
    /** Build an adoption candidate without changing local history; publish it with state CAS. */
    prepare(owner: StorageOwner, remote: Y.Doc): Promise<Y.Doc | null>;
    /** Merge under the local document lock and return a disposable committed snapshot. */
    merge(owner: StorageOwner, remote: Y.Doc): Promise<Y.Doc | null>;
  };
  transaction<T>(owner: StorageOwner, action: (state: DocumentState) => Promise<T>): Promise<T>;
}

export const hasDocumentUserData = (document: Y.Doc) =>
  document.getMap("records").size > 0 || document.getMap("deleted").size > 0 || document.getText("content").length > 0;

/** Pending structures and delete sets are history even when the visible state vector is empty. */
export const isEmptyDocument = (document: Y.Doc) => {
  const state = Y.encodeStateAsUpdate(document);
  return state.length === 2 && state[0] === 0 && state[1] === 0;
};

export const memoryDocumentState = (document: Y.Doc) => {
  const operations = new Map<string, string>();
  return {
    document,
    operation: async (id: string) => operations.get(id),
    remember: (id: string, fingerprint: string) => {
      operations.set(id, fingerprint);
    },
  } satisfies DocumentState;
};
