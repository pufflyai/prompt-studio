import type { AssetReference, ExtensionAssetsApi } from "pstdio-api-contracts/extension-kernel";
import { hashAssetSource } from "../client/asset-source";

/** Memory test storage has complete immutable Blobs and no interrupted disk writes. */
export const createMemoryAssets = () => {
  const versions = new Map<string, Blob>();
  const operations = new Map<string, AssetReference>();
  const getTransfer = async (operationId: string) => {
    const asset = operations.get(operationId);
    return asset ? { status: "complete" as const, operationId, asset: { ...asset } } : undefined;
  };
  const read = async (asset: AssetReference) => {
    const source = versions.get(asset.sha256);
    if (!source) throw new Error("Complete asset not found");
    if (source.size !== asset.byteLength) throw new Error("Asset integrity mismatch");
    return source.stream();
  };
  const api: ExtensionAssetsApi = {
    async stage({ operationId, source }) {
      const expected = {
        sha256: await hashAssetSource(source),
        byteLength: source.size,
        mediaType: source.type || "application/octet-stream",
      };
      const existing = operations.get(operationId);
      if (
        existing &&
        (existing.sha256 !== expected.sha256 ||
          existing.byteLength !== expected.byteLength ||
          existing.mediaType !== expected.mediaType)
      )
        throw new Error("ASSET_OPERATION_CONFLICT");
      operations.set(operationId, expected);
      versions.set(expected.sha256, source);
      return { ...expected };
    },
    getTransfer,
    cancel: getTransfer,
    read,
    async verifyComplete(assets) {
      for (const asset of assets) await (await read(asset)).cancel();
    },
  };
  return api;
};
