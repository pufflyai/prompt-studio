import type { AssetReference, AssetTransfer } from "../../assets";

export type { AssetReference, AssetTransfer } from "../../assets";

/** Immutable bytes that records refer to. */
export interface ExtensionAssetsApi {
  /** Reuse the operation identity and the same source to resume after interruption. */
  stage(input: { operationId: string; source: Blob }): Promise<AssetReference>;
  getTransfer(operationId: string): Promise<AssetTransfer | undefined>;
  cancel(operationId: string): Promise<AssetTransfer | undefined>;
  /** Consume the stream to its end before treating the download as verified. */
  read(asset: AssetReference): Promise<ReadableStream<Uint8Array>>;
  /** Verify that the bytes are complete before a record refers to them. */
  verifyComplete(assets: AssetReference[]): Promise<void>;
}
