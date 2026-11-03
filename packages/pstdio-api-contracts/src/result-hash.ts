import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const encoder = new TextEncoder();

// The host hashes large results natively; browser SDK callers use the same SHA-256 in JavaScript.
export const createResultHash = () => {
  const native = typeof Bun === "undefined" ? undefined : new Bun.CryptoHasher("sha256");
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
