import type { StorageOwner } from "pstdio-sync";

export interface StorageDiagnostic {
  phase:
    | "document-captured"
    | "document-hydrated"
    | "document-loaded"
    | "checkpoint-captured"
    | "checkpoint-compacted"
    | "checkpoint-persisted"
    | "receiver-persisted"
    | "records-projected"
    | "records-queried";
  owner: StorageOwner;
  documentId?: string;
  sourceRevision?: number;
  records?: number;
  bytes?: number;
}

export type StorageDiagnostics = (event: StorageDiagnostic) => void;
