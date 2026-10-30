import type { Asset, StorageGroup } from "pstdio-sync-contracts";
export interface AssetStore {
  verifyComplete(assets: Asset[]): Promise<void>;
  read(asset: Asset): Promise<ReadableStream<Uint8Array>>;
  /** Stores an asset from `source`, resuming at `offset`. Bytes that can never match reject with `UnreadableSyncData`. */
  receive(
    asset: Asset,
    source: (offset: number, signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>,
  ): Promise<void>;
}

export interface RelayAssets {
  put(asset: Asset, source: () => Promise<ReadableStream<Uint8Array>>): Promise<void>;
  get(asset: Asset, offset: number, signal?: AbortSignal): Promise<ReadableStream<Uint8Array> | null>;
}

export interface StorageOwner {
  workbenchId: string;
  extensionId: string;
}

export interface StorageObserver {
  /** A native save's captured read version, checked while holding the record write lock. */
  expected?(owner: StorageOwner, recordId: string): string | undefined;
  read(owner: StorageOwner, record: { recordId: string; revision: string }): void;
  group(owner: StorageOwner, group: StorageGroup): StorageGroup;
  committed(owner: StorageOwner, records: { recordId: string; revision: string }[], outcome: { status: string }): void;
}
