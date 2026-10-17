import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export const hashAssetSource = async (source: Blob, signal?: AbortSignal) => {
  const hash = sha256.create();
  const reader = source.stream().getReader();
  const abort = () => {
    void reader.cancel(signal?.reason).catch(() => undefined);
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      hash.update(value);
    }
    return bytesToHex(hash.digest());
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
};
