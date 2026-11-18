import { bytesToHex } from "@noble/hashes/utils.js";

const digits = "0123456789abcdef";

const validatePosition = (position: string | undefined) => {
  if (position !== undefined && !/^[0-9a-f]*[1-9a-f]$/.test(position)) throw new Error("Invalid order position");
};

// Advance by one eight-digit unit on an open end. Bisecting the unbounded gap
// on every append adds a shared hex digit every four inserts. Keep exhausted
// leading digits from older positions so their original order is preserved.
const outsidePrefix = (bound: string, step: 1 | -1) => {
  const exhausted = step === 1 ? "f" : "0";
  let start = 0;
  while (bound[start] === exhausted) start++;
  const width = 8;
  const unit = Number.parseInt(bound.slice(start, start + width).padEnd(width, "0"), 16);
  return bound.slice(0, start) + (unit + step).toString(16).padStart(width, "0");
};

const positionPrefix = (before?: string, after?: string) => {
  if (before === undefined) return after === undefined ? "8" : outsidePrefix(after, -1);
  if (after === undefined) return outsidePrefix(before, 1);

  let prefix = "";
  let upper: string | undefined = after;
  for (let index = 0; ; index++) {
    const low = digits.indexOf(before[index] ?? "0");
    const high = upper === undefined ? 16 : digits.indexOf(upper[index] ?? "0");
    if (high - low > 1) return prefix + digits[Math.floor((low + high) / 2)];
    prefix += digits[low];
    if (low < high) upper = undefined;
  }
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
      // Keep the device and random suffix inside the fraction so even concurrent neighbours stay divisible.
      const suffix = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
      return `${positionPrefix(before, after)}${device}0${suffix}1`;
    },
  };
};
