import type { Json } from "pstdio-sync-contracts";

// Unicode mode treats a valid surrogate pair as one code point outside this range.
const wellFormedText = (value: string) => value.replace(/[\uD800-\uDFFF]/gu, "\uFFFD");

// Yjs replaces lone surrogates on serialization. Apply that same boundary before
// values become observable or projected, so reopening cannot change their revision.
export const normalizeDocumentJson = (value: Json) => {
  let result: Json = value;
  if (typeof value === "string") result = wellFormedText(value);
  else if (Array.isArray(value)) {
    const items: Json[] = [];
    for (const item of value) items.push(normalizeDocumentJson(item));
    result = items;
  } else if (value !== null && typeof value === "object") {
    const entries: [string, Json][] = [];
    for (const [key, item] of Object.entries(value)) entries.push([wellFormedText(key), normalizeDocumentJson(item)]);
    result = Object.fromEntries(entries);
  }
  return result;
};
