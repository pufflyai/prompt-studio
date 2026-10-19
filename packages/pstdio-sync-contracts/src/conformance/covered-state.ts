import type { z } from "zod";
import type { CheckpointGroup, coverageAckSchema } from "../checkpoint";
import { fingerprint } from "../fingerprint";
import { coveredAssetClosure, coveredSnapshotSchema } from "../retention";
import type { Snapshot, StoredRecord } from "../state";
import type { Asset, Scope } from "../wire";
import { own } from "./dictionary";

export interface CoveredReceipt {
  group: CheckpointGroup;
  status: "accepted" | "pending" | "conflict";
  cut: number | null;
}
export interface CoveredState {
  protocolVersion: 2;
  scope: Scope;
  epoch: string;
  generation: number;
  cut: number;
  covered: number;
  records: Record<string, StoredRecord>;
  conflicts: Snapshot["conflicts"];
  publishedRevision: string;
  documents: Record<string, number>;
  receipts: Record<string, CoveredReceipt>;
  writers: Record<string, { floor: number }>;
  acknowledgements: Record<string, z.infer<typeof coverageAckSchema>>;
  backup: { cut: number; epoch: string; generation: number; snapshotHash: string; manifestHash: string } | null;
  pins: Record<string, Asset[]>;
  barrier: { documentId: string; joined: string[] } | null;
  assets: Asset[];
}
export type CoveredTransaction = <T>(scope: Scope, action: (state: CoveredState) => Promise<T>) => Promise<T>;
export const snapshotHash = (state: CoveredState) => fingerprint(publicCoveredSnapshot(state));
export const operationKey = (group: CheckpointGroup) => `${group.environmentId}:${group.sequence}`;
export const documentGeneration = (state: CoveredState, documentId: string) => own(state.documents, documentId) ?? 0;
export function acceptedParent(state: Pick<CoveredState, "receipts" | "writers">, key: string) {
  if (state.receipts[key]?.status === "accepted") return true;
  const separator = key.lastIndexOf(":");
  const environmentId = key.slice(0, separator);
  const sequence = Number(key.slice(separator + 1));
  return (
    Object.hasOwn(state.writers, environmentId) &&
    Number.isSafeInteger(sequence) &&
    sequence > 0 &&
    sequence <= state.writers[environmentId].floor
  );
}
export const newCoveredState = (scope: Scope) => {
  const state: CoveredState = {
    protocolVersion: 2,
    scope,
    epoch: crypto.randomUUID(),
    generation: 0,
    cut: 0,
    covered: 0,
    records: {},
    conflicts: {},
    publishedRevision: "published-1",
    documents: {},
    receipts: {},
    writers: { a: { floor: 0 }, b: { floor: 0 }, c: { floor: 0 } },
    acknowledgements: {},
    backup: null,
    pins: {},
    barrier: null,
    assets: [],
  };
  return state;
};
export function retainedClosure(state: CoveredState) {
  const retained = new Set(
    Object.values(state.acknowledgements).flatMap((ack) => [
      ...ack.branches,
      ...ack.recovery.flatMap((recovery) => recovery.branches),
    ]),
  );
  const settled = settledCuts(state);
  for (const key of Object.keys(state.receipts)) if (!settled.has(key)) retained.add(key);
  const visit = (key: string) => {
    const receipt = state.receipts[key];
    if (!receipt) throw new Error(`Missing recovery ancestry: ${key}`);
    for (const parent of receipt.group.parents)
      if (!retained.has(parent) && Object.hasOwn(state.receipts, parent)) {
        retained.add(parent);
        visit(parent);
      }
  };
  for (const key of retained) {
    visit(key);
    // A retained superseded branch also needs its resolution outcome until it can retire.
    for (const [resolutionId, receipt] of Object.entries(state.receipts))
      if (receipt.status === "accepted" && recoveredSources(receipt.group).includes(key)) retained.add(resolutionId);
  }
  return retained;
}
export function requiredAssets(state: CoveredState) {
  return coveredAssetClosure(publicCoveredSnapshot(state));
}
export const publicCoveredSnapshot = (state: CoveredState) =>
  coveredSnapshotSchema.parse({
    protocolVersion: 2,
    scope: state.scope,
    epoch: state.epoch,
    generation: state.generation,
    cut: state.cut,
    covered: state.covered,
    records: state.records,
    conflicts: state.conflicts,
    publishedRevision: state.publishedRevision,
    documents: state.documents,
    receipts: state.receipts,
    writers: state.writers,
    retainedBranches: [...retainedClosure(state)],
  });
export function settledCuts(state: CoveredState) {
  const settled = new Map<string, number>();
  for (const [key, receipt] of Object.entries(state.receipts))
    if (receipt.cut !== null) {
      settled.set(key, receipt.cut);
      for (const captured of recoveredSources(receipt.group)) settled.set(captured, receipt.cut);
    }
  return settled;
}
export const recoveredSources = (group: CheckpointGroup) => [
  ...(group.resolution?.capturedOperationIds ?? []),
  ...(group.rebase?.sources.map((source) => source.operationId) ?? []),
];
export function safeCoverage(state: CoveredState) {
  let cut = state.cut;
  const blockers: string[] = [];
  const environment = environmentCoverage(state);
  cut = Math.min(cut, environment.cut);
  blockers.push(...environment.blockers);
  if (!state.backup || state.backup.epoch !== state.epoch || state.backup.generation !== state.generation) {
    blockers.push("verified-backup");
    cut = 0;
  } else {
    cut = Math.min(cut, state.backup.cut);
    if (state.backup.cut < state.cut) blockers.push("verified-backup");
  }
  for (const key of retainedClosure(state)) {
    const receipt = state.receipts[key];
    if (receipt.cut !== null && receipt.cut <= cut) {
      cut = Math.max(0, receipt.cut - 1);
      blockers.push(`branch:${key}`);
    }
  }
  if (Object.keys(state.pins).length) {
    blockers.push("in-flight-publication-or-backup");
    cut = Math.min(cut, state.covered);
  }
  return { cut: Math.max(state.covered, cut), blockers };
}

function environmentCoverage(state: CoveredState) {
  let cut = state.cut;
  const blockers: string[] = [];
  for (const environmentId of Object.keys(state.writers)) {
    const ack = own(state.acknowledgements, environmentId);
    if (!ack || ack.epoch !== state.epoch || ack.generation !== state.generation) {
      blockers.push(`environment:${environmentId}`);
      cut = 0;
    } else {
      cut = Math.min(cut, ack.cut);
      if (ack.cut < state.cut) blockers.push(`environment:${environmentId}`);
      for (const recovery of ack.recovery)
        if (recovery.revision > recovery.checkpointRevision) {
          cut = Math.min(cut, recovery.baseCut);
          blockers.push(`recovery:${environmentId}:${recovery.recordId}`);
        }
    }
  }

  return { cut, blockers };
}

export function recoveryAssets(state: CoveredState) {
  const assets = new Map(requiredAssets(state).map((asset) => [asset.sha256, asset]));
  for (const receipt of Object.values(state.receipts))
    for (const change of receipt.group.changes) {
      for (const asset of [change.asset?.base, change.asset?.next]) if (asset) assets.set(asset.sha256, asset);
    }
  return [...assets.values()];
}
