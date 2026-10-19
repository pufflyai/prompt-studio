import type { Asset, Mutation, Snapshot } from "pstdio-sync-contracts";
import type { AssetStore, RelayAdapter } from "./types";

class MissingRemoteAsset extends Error {}

export const uploadMutationAssets = async (
  local: AssetStore | undefined,
  adapter: RelayAdapter,
  mutation: Mutation,
) => {
  for (const change of mutation.changes) {
    const asset = change.asset?.next;
    if (!asset) continue;
    if (!local || !adapter.assets) throw new Error("Asset transport is unavailable");
    await adapter.assets.put(asset, () => local.read(asset));
  }
};

const downloadAsset = async (local: AssetStore | undefined, adapter: RelayAdapter, asset: Asset, required: boolean) => {
  if (!local) {
    if (required) throw new Error("Asset storage is unavailable");
    return;
  }
  try {
    await local.verifyComplete([asset]);
    return;
  } catch {
    // The byte owner either resumes the retained transfer or verifies a fresh one.
  }
  if (!adapter.assets) {
    if (required) throw new Error("Asset transport is unavailable");
    return;
  }
  try {
    await local.receive(asset, async (offset, signal) => {
      const source = await adapter.assets!.get(asset, offset, signal);
      if (!source) throw new MissingRemoteAsset(`Required asset is incomplete: ${asset.sha256}`);
      return source;
    });
  } catch (error) {
    if (!required && error instanceof MissingRemoteAsset) return;
    throw error;
  }
};

export const downloadSnapshotAssets = async (
  local: AssetStore | undefined,
  adapter: RelayAdapter,
  snapshot: Snapshot,
) => {
  const references = new Map<string, { asset: Asset; required: boolean }>();
  const add = (asset: Asset | null | undefined, required: boolean) => {
    if (asset)
      references.set(asset.sha256, { asset, required: required || references.get(asset.sha256)?.required === true });
  };
  for (const record of Object.values(snapshot.records)) if (!record.deleted) add(record.asset, true);
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const receipt = Object.hasOwn(snapshot.receipts, id) ? snapshot.receipts[id] : undefined;
    // An unfinished group may name a parent its writer has not uploaded yet.
    if (!receipt) return;
    for (const change of receipt.mutation.changes) {
      add(change.asset?.base, receipt.status !== "pending");
      add(change.asset?.next, receipt.status !== "pending");
    }
    for (const parent of receipt.mutation.parents) visit(parent);
  };
  for (const id of snapshot.retainedBranches) visit(id);
  for (const { asset, required } of references.values()) await downloadAsset(local, adapter, asset, required);
};
