import { type Asset, fingerprint } from "pstdio-sync-contracts";
import { checkedBytes, multipartSize } from "../assets/streams";

export const jsonAsset = (bytes: Uint8Array) => ({
  sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
  byteLength: bytes.byteLength,
  mediaType: "application/json",
});
export const byteStream = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
export const copyKey = async (asset: Asset) => `objects/${await fingerprint(asset)}`;

export async function* backupParts(body: ReadableStream<Uint8Array>, asset: Asset, signal: AbortSignal) {
  const buffer = new Uint8Array(multipartSize(asset.byteLength));
  let used = 0;
  for await (const chunk of checkedBytes(body, asset, signal)) {
    let offset = 0;
    while (offset < chunk.length) {
      const length = Math.min(buffer.length - used, chunk.length - offset);
      buffer.set(chunk.subarray(offset, offset + length), used);
      used += length;
      offset += length;
      if (used === buffer.length) {
        yield buffer.slice();
        used = 0;
      }
    }
  }
  if (used) yield buffer.slice(0, used);
}
