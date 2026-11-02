import { bytesToHex } from "@noble/hashes/utils.js";

/** Import a stable rank into the same finite fractions used by ordinary moves. */
export const createStorageMigrationPosition = (rank: number, key: string) => {
  if (!Number.isSafeInteger(rank) || rank < 0)
    throw new RangeError("Order position rank must be a nonnegative safe integer");
  // Offline source lists may differ. Stable keys separate equal ranks without random input.
  const suffix = bytesToHex(new TextEncoder().encode(JSON.stringify(key)));
  return `${(BigInt(rank) + 1n).toString(16).padStart(14, "0")}${suffix}1`;
};
