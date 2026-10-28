import { type Asset, canonicalJson, type Mutation, type Snapshot } from "pstdio-sync-contracts";
import type { AssetStore } from "../shared";
import type { RelayAdapter } from "./types";

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
  for (const receipt of Object.values(snapshot.receipts)) {
    for (const change of receipt.mutation.changes) {
      const asset = change.asset?.next;
      if (!asset) continue;
      const key = canonicalJson(asset);
      references.set(key, { asset, required: receipt.status !== "pending" || references.get(key)?.required === true });
    }
  }
  for (const record of Object.values(snapshot.records))
    if (record.asset) references.set(canonicalJson(record.asset), { asset: record.asset, required: true });
  for (const { asset, required } of references.values()) await downloadAsset(local, adapter, asset, required);
};
