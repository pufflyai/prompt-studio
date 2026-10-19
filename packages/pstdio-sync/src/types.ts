import type {
  Asset,
  Change,
  Checkpoint,
  CoverageAck,
  CoverageResult,
  Mutation,
  Peer,
  Receipt,
  Scope,
  Snapshot,
  StorageGroup,
  StorageResolution,
} from "pstdio-sync-contracts";

export interface AssetStore {
  verifyComplete(assets: Asset[]): Promise<void>;
  read(asset: Asset): Promise<ReadableStream<Uint8Array>>;
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

export type GroupCommit = StorageGroup;
export type ResolutionCommit = StorageResolution;

export interface LocalOperation {
  operationId: string;
  environmentId: string;
  parents: string[];
  changes: Change[];
  resolution?: Mutation["resolution"];
  document?: Mutation["document"];
  position?: Pick<Mutation, "epoch" | "generation" | "sequence">;
}

export interface Acceptance {
  fingerprint: string;
  order: number;
  checkpoint: Checkpoint;
}

export interface JournalEntry {
  inputFingerprint: string;
  mutation: LocalOperation;
  acceptance?: Acceptance | null;
  recoveryProof?: string;
}

export interface GroupedState {
  owner: StorageOwner;
  accepted: Snapshot | null;
  journal: JournalEntry[];
}

export interface StorageObserver {
  read(owner: StorageOwner, record: { recordId: string; revision: string }): void;
  group(owner: StorageOwner, group: StorageGroup): StorageGroup;
  committed(owner: StorageOwner, records: { recordId: string; revision: string }[], outcome: { status: string }): void;
}

export interface GroupedStore {
  observer?: StorageObserver;
  transaction<T>(owner: StorageOwner, action: (state: GroupedState) => Promise<T>): Promise<T>;
}

export interface RelayAdapter {
  scope: Scope;
  peer?: Peer;
  assets?: RelayAssets;
  snapshot(): Promise<Snapshot>;
  acknowledge?(ack: CoverageAck): Promise<CoverageResult>;
  submit(mutation: Mutation): Promise<Receipt>;
  recover?(mutation: Mutation, proof: string): Promise<Receipt>;
}
