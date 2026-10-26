import type { StorageOwner } from "pstdio-sync";

export interface StorageDiagnostic {
  phase: "document-loaded" | "records-projected" | "records-queried";
  owner: StorageOwner;
  records?: number;
  bytes?: number;
}

export type StorageDiagnostics = (event: StorageDiagnostic) => void;
