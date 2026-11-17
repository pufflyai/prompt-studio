import type { StorageOwner } from "pstdio-sync";

export interface StorageDiagnostic {
  phase: "document-loaded" | "records-projected" | "records-queried" | "index-records-read";
  owner: StorageOwner;
  records?: number;
  /** Database rows materialized, including the one continuation probe. */
  materialized?: number;
  bytes?: number;
}

export type StorageDiagnostics = (event: StorageDiagnostic) => void;
