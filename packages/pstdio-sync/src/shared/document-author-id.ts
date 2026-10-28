// Deterministic authors use 49 bits, above Yjs's random 32-bit device IDs.
export const deterministicAuthors = 2 ** 48;
export const documentAuthorId = (key: string) => {
  let first = 2166136261;
  let second = 3339675911;
  for (let index = 0; index < key.length; index++) {
    first = Math.imul(first ^ key.charCodeAt(index), 16777619) >>> 0;
    second = Math.imul(second ^ key.charCodeAt(index), 2246822519) >>> 0;
  }
  return deterministicAuthors + first * 65536 + (second >>> 16);
};
