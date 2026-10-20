import type * as Y from "yjs";
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
  observer?: StorageObserver;
  transaction<T>(owner: StorageOwner, action: (state: DocumentState) => Promise<T>): Promise<T>;
}

export const hasDocumentUserData = (document: Y.Doc) =>
  document.getMap("records").size > 0 || document.getMap("deleted").size > 0 || document.getText("content").length > 0;

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
