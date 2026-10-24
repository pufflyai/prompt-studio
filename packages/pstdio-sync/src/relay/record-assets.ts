import type { Asset, AssetReference } from "pstdio-sync-contracts";
import { openBlob, type SyncSpace, sealBlob } from "../encryption";
import type { AssetStore } from "../types";
import type { DocumentRelay } from "./document-sync-types";

/** Local memory of which relay blob holds each asset's ciphertext, so retries reuse the same bytes. */
export interface AssetReferences {
  get(sha256: string): Promise<AssetReference | undefined>;
  set(reference: AssetReference): Promise<void>;
}

const sha256 = async (bytes: Uint8Array) => {
  const hash = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/** Moves the files that synced records point to. A record never arrives before its file (R21). */
export const createRecordAssets = (input: {
  space: SyncSpace;
  assets?: AssetStore;
  blobs?: DocumentRelay["blobs"];
  references: AssetReferences;
}) => {
  const require = () => {
    if (!input.assets || !input.blobs) throw new Error("Record asset transport is unavailable");
    return { assets: input.assets, blobs: input.blobs };
  };
  const read = async (asset: Asset) =>
    new Uint8Array(await new Response(await require().assets.read(asset)).arrayBuffer());
  const save = (asset: Asset, bytes: Uint8Array) =>
    require().assets.receive(asset, async (offset) =>
      new Blob([bytes.subarray(offset) as Uint8Array<ArrayBuffer>]).stream(),
    );
  const complete = async (asset: Asset) => {
    try {
      await require().assets.verifyComplete([asset]);
      return true;
    } catch {
      return false;
    }
  };
  const encrypt = async (asset: Asset) => {
    const sealed = await sealBlob(input.space, await read(asset));
    const encrypted = {
      sha256: await sha256(sealed.bytes),
      byteLength: sealed.bytes.length,
      mediaType: "application/octet-stream",
    };
    // Keep the ciphertext before its random relay ID is remembered, so a retry uploads the same bytes.
    await save(encrypted, sealed.bytes);
    const reference = { asset, blobId: sealed.blobId, encrypted };
    await input.references.set(reference);
    return reference;
  };
  return {
    /**
     * Uploads each asset's ciphertext and returns where other devices find it. With `reuse`, a file
     * already known to be on the relay is not read or uploaded again.
     */
    async upload(assets: Asset[], reuse = false) {
      const references: AssetReference[] = [];
      for (const asset of new Map(assets.map((asset) => [asset.sha256, asset])).values()) {
        const known = await input.references.get(asset.sha256);
        if (known && reuse) {
          references.push(known);
          continue;
        }
        const reference = known && (await complete(known.encrypted)) ? known : await encrypt(asset);
        await require().blobs.put(reference.blobId, await read(reference.encrypted));
        references.push(reference);
      }
      return references;
    },
    /** Downloads and decrypts every referenced asset this device does not have yet. */
    async download(references: AssetReference[]) {
      for (const reference of references) {
        if (await complete(reference.asset)) continue;
        if (!(await complete(reference.encrypted))) {
          const { assets, blobs } = require();
          // A ranged read lets an interrupted download continue from the bytes already stored.
          const read = blobs.read;
          if (read) await assets.receive(reference.encrypted, (offset) => read(reference.blobId, offset));
          else await save(reference.encrypted, await blobs.get(reference.blobId));
        }
        await save(reference.asset, await openBlob(input.space, reference.blobId, await read(reference.encrypted)));
        await input.references.set(reference);
      }
    },
  };
};
