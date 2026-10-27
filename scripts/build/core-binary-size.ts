import { statSync } from "node:fs";

export const MAX_CORE_BINARY_BYTES = 200_000_000;

export const assertCoreBinarySize = (path: string, bytes = statSync(path).size) => {
  if (bytes > MAX_CORE_BINARY_BYTES) {
    throw new Error(`Core binary ${path} is ${bytes} bytes; the hard limit is 200 MB (200000000 bytes).`);
  }
};
