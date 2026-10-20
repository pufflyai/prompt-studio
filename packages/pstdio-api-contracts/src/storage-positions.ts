import { bytesToHex } from "@noble/hashes/utils.js";
import { createStorageId } from "./storage-identities";

const digits = "0123456789abcdef";

const validatePosition = (position: string | undefined) => {
  if (position !== undefined && !/^[0-9a-f]*[1-9a-f]$/.test(position)) throw new Error("Invalid order position");
};

/** Finite base-16 fractions, ordered with ordinary string comparison. */
export const createStoragePositions = (deviceId: string) => {
  const device = bytesToHex(new TextEncoder().encode(deviceId));
  return {
    between(before?: string, after?: string) {
      validatePosition(before);
      validatePosition(after);
      if (before !== undefined && after !== undefined && before >= after)
        throw new Error("Order positions must be strictly increasing");
      let prefix = "";
      let upper = after;
      for (let index = 0; ; index++) {
        const low = index < (before?.length ?? 0) ? digits.indexOf(before![index]!) : 0;
        const high = upper === undefined ? 16 : digits.indexOf(upper[index] ?? "0");
        if (high - low > 1) {
          // Include the suffix in future midpoint calculations. Concurrent neighbours stay divisible.
          // A final nonzero digit keeps every finite position strictly above its zero-padded prefix.
          return `${prefix}${digits[Math.floor((low + high) / 2)]}${device}0${createStorageId().replaceAll("-", "")}1`;
        }
        prefix += digits[low];
        if (low < high) upper = undefined;
      }
    },
  };
};
