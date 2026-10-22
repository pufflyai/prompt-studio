import { type Asset, assetSchema, syncIdSchema } from "pstdio-sync-contracts";
import type * as Y from "yjs";

export interface BlobReference {
  blobId: string;
  encrypted: Asset;
}
export interface DocumentBlob {
  asset: Asset;
  reference?: BlobReference;
}

export const documentBlobManifest = (document: Y.Doc) => {
  const assets = new Map<string, DocumentBlob>();
  const references = document.getMap<BlobReference>("sync-blobs");
  for (const name of document.getMap<string>("records").values()) {
    const value = document.getMap(name).get("asset");
    if (!value) continue;
    const asset = assetSchema.parse(value);
    const reference = references.get(asset.sha256);
    assets.set(asset.sha256, { asset, reference });
  }
  return [...assets.values()];
};

export const validateDocumentBlobManifest = (blobs: DocumentBlob[]) => {
  for (const { reference } of blobs) {
    if (!reference) throw new Error("Synced asset has no blob ID");
    syncIdSchema.parse(reference.blobId);
    assetSchema.parse(reference.encrypted);
  }
};
