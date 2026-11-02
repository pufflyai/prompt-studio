import type { ExtensionAssetsApi } from "./assets";
import type { JsonObject } from "./json";
import type { ResourceRef } from "./resources";
import type { ExtensionRecordsApi } from "./storage-records";

/** @deprecated Use storage.records with stable record IDs and grouped commits. */
export interface ExtensionStorageCollectionApi<TItem = unknown> {
  get(id: string): Promise<TItem | undefined>;
  list(): Promise<TItem[]>;
  /** @deprecated Use storage.records.commit. */
  put(id: string, value: TItem): Promise<void>;
  /** @deprecated Use storage.records.commit. Throws if the item was deleted. */
  update(id: string, value: TItem): Promise<void>;
  createIfAbsent(id: string, value: TItem): Promise<boolean>;
  deleteIfValue(id: string, value: TItem): Promise<boolean>;
  create(value: TItem): Promise<TItem & { id: string }>;
  delete(id: string): Promise<void>;
  attachments(itemId: string): ExtensionBlobsApi;
}

export type StorageScope =
  | { type: "project" }
  | { type: "resource"; resource: ResourceRef }
  | { type: string; id: string };

export interface ExtensionStorageMigration {
  /** Import a zero-based rank deterministically. A stable unique item key separates equal ranks on offline devices. */
  position(rank: number, key: string): string;
  /** Derive the same ID from a stable source key. A prefix selects lossless, case-sensitive Base62 output. */
  id(key: string, prefix?: string): string;
}

export interface ExtensionStoragePositionsApi {
  /** Create a unique position between neighbours. Omit either end; compare with < and >, not localeCompare. */
  between(before?: string, after?: string): string;
}

export interface ExtensionStorageApi {
  /** Upgrade this storage scope once. Saves the version after success; failed work must be safe to retry. */
  migrate(
    version: number,
    run: (previousVersion: number, migration: ExtensionStorageMigration) => Promise<void>,
  ): Promise<void>;
  /** Create a UUIDv7. A prefix selects lossless, case-sensitive Base62 output. Use migration.id for imports. */
  ids: { create(prefix?: string): string };
  positions: ExtensionStoragePositionsApi;
  /** Read retained records from a removed schema, restricted to this project and instance. */
  readLegacy(source: string): Promise<{ version: string; records: JsonObject[] } | undefined>;
  records: ExtensionRecordsApi;
  assets: ExtensionAssetsApi;
  scope(scope: StorageScope): ExtensionStorageApi;
  files: ExtensionBlobsApi;
  /** @deprecated Use records.read to keep the observed revision with the value. */
  get<T = unknown>(key: string): Promise<T | undefined>;
  /** @deprecated Use records.commit. */
  set<T = unknown>(key: string, value: T): Promise<void>;
  /** @deprecated Use records.commit with deleted: true. */
  delete(key: string): Promise<void>;
  /** @deprecated Use records with stable record IDs and grouped commits. */
  collection<TItem = unknown>(name: string): ExtensionStorageCollectionApi<TItem>;
}

export interface ExtensionBlobRef {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  hash: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionBlobInput {
  name: string;
  data: Uint8Array | ArrayBuffer;
  mimeType?: string | null;
}

export interface ExtensionBlobsApi {
  put(input: ExtensionBlobInput): Promise<ExtensionBlobRef>;
  /** Replace an existing file's bytes while retaining its identity and scope. */
  update(id: string, input: ExtensionBlobInput): Promise<ExtensionBlobRef>;
  get(id: string): Promise<ExtensionBlobRef | undefined>;
  getBytes(id: string): Promise<Uint8Array>;
  list(): Promise<ExtensionBlobRef[]>;
  delete(id: string): Promise<void>;
  urlFor(id: string): string;
}
