import type {
  Change,
  Checkpoint,
  Mutation,
  Peer,
  Receipt,
  Scope,
  Snapshot,
  StorageGroup,
  StorageResolution,
} from "pstdio-sync-contracts";
import type { RelayAssets, StorageObserver, StorageOwner } from "../shared";
import type { RecordProjection } from "./projection";

export type GroupCommit = StorageGroup;
export type ResolutionCommit = StorageResolution;

export interface LocalOperation {
  operationId: string;
  environmentId: string;
  parents: string[];
  changes: Change[];
  resolution?: Mutation["resolution"];
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

export interface GroupedStore {
  observer?: StorageObserver;
  project?(owner: StorageOwner, environmentId: string): Promise<RecordProjection>;
  transaction<T>(owner: StorageOwner, action: (state: GroupedState) => Promise<T>): Promise<T>;
}

export interface RelayAdapter {
  scope: Scope;
  peer?: Peer;
  assets?: RelayAssets;
  snapshot(): Promise<Snapshot>;
  submit(mutation: Mutation): Promise<Receipt>;
  recover?(mutation: Mutation, proof: string): Promise<Receipt>;
}
