import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const encoder = new TextEncoder();

interface NativeResultHash {
  update(text: string): NativeResultHash;
  copy(): NativeResultHash;
  digest(encoding: "hex"): string;
}

// The host hashes large results natively; browser SDK callers use the same SHA-256 in JavaScript.
export const createResultHash = () => {
  const runtime = globalThis as typeof globalThis & {
    Bun?: { CryptoHasher: new (algorithm: "sha256") => NativeResultHash };
  };
  const NativeHasher = runtime.Bun?.CryptoHasher;
  const native = NativeHasher ? new NativeHasher("sha256") : undefined;
  const portable = native ? undefined : sha256.create();
  return {
    update(text: string) {
      if (native) native.update(text);
      else portable!.update(encoder.encode(text));
    },
    digest(suffix = "") {
      if (native) return native.copy().update(suffix).digest("hex");
      return bytesToHex(portable!.clone().update(encoder.encode(suffix)).digest());
    },
  };
};
