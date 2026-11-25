/** Decode captured bytea without a repeated-group regexp's size-dependent stack limit. */
export const decodeUpgradeBytes = (value: unknown) => {
  if (typeof value !== "string" || value.length % 2 !== 0 || !/^\\x[0-9a-f]*$/iu.test(value))
    throw new Error("Invalid exported storage bytes");
  return new Uint8Array(Buffer.from(value.slice(2), "hex"));
};
