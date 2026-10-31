import assert from "node:assert/strict";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { AssetStore } from "pstdio-sync";
import type { Asset } from "pstdio-sync-contracts";

/** Disk-backed, digest-checked fixture assets. Each device owns a separate directory. */
export const createFiles = async (directory: string) => {
  await mkdir(directory, { recursive: true });
  const path = (asset: Asset) => join(directory, asset.sha256);
  const complete = new Set<string>();
  const digest = async (file: string) => {
    const hash = new Bun.CryptoHasher("sha256");
    for await (const chunk of Bun.file(file).stream()) hash.update(chunk);
    return hash.digest("hex");
  };
  const store: AssetStore = {
    async verifyComplete(assets) {
      for (const asset of assets) {
        assert(complete.has(asset.sha256), "Asset has not passed full digest verification");
        assert.equal((await stat(path(asset))).size, asset.byteLength);
      }
    },
    read: async (asset) => Bun.file(path(asset)).stream(),
    async receive(asset, source) {
      const file = path(asset);
      const offset = await stat(file).then(
        (value) => value.size,
        () => 0,
      );
      const writer = await open(file, "a");
      try {
        for await (const chunk of await source(offset, new AbortController().signal)) await writer.writeFile(chunk);
        await writer.sync();
      } finally {
        await writer.close();
      }
      assert.equal((await stat(file)).size, asset.byteLength);
      assert.equal(await digest(file), asset.sha256);
      complete.add(asset.sha256);
    },
  };
  return {
    store,
    async generate(byteLength: number, index: number) {
      const temporary = join(directory, `generate-${index}`);
      const writer = await open(temporary, "w");
      const hash = new Bun.CryptoHasher("sha256");
      // Different, reproducible byte streams prevent content deduplication from shrinking the workload.
      const block = new Uint8Array(1024 * 1024);
      let random = index + 1;
      for (let at = 0; at < block.length; at++) {
        random ^= random << 13;
        random ^= random >>> 17;
        random ^= random << 5;
        block[at] = random & 255;
      }
      for (let offset = 0; offset < byteLength; offset += block.length) {
        new DataView(block.buffer).setBigUint64(0, BigInt(offset));
        const current = block.subarray(0, Math.min(block.length, byteLength - offset));
        hash.update(current);
        await writer.writeFile(current);
      }
      await writer.close();
      const asset = { sha256: hash.digest("hex"), byteLength, mediaType: "application/octet-stream" };
      await rename(temporary, path(asset));
      complete.add(asset.sha256);
      return asset;
    },
    clear: () => rm(directory, { recursive: true, force: true }),
  };
};
