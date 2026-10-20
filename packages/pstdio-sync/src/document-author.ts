import { canonicalJson, type Json } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import type { DocumentHistory } from "./document-history";

// Deterministic authors use 49 bits, above Yjs's random 32-bit device IDs.
export const documentAuthorId = (key: string) => {
  let first = 2166136261;
  let second = 3339675911;
  for (let index = 0; index < key.length; index++) {
    first = Math.imul(first ^ key.charCodeAt(index), 16777619) >>> 0;
    second = Math.imul(second ^ key.charCodeAt(index), 2246822519) >>> 0;
  }
  return 2 ** 48 + first * 65536 + (second >>> 16);
};
export type DocumentAuthor = <T>(parent: string, key: string, value: Json, action: () => T) => T;
export const migrationAuthor = (document: Y.Doc, seed?: string, history?: DocumentHistory) => {
  if (!seed) return undefined;
  const author: DocumentAuthor = (parent, key, value, action) => {
    const current = document.getMap(parent).get(key) as { kind?: string; name?: string } | undefined;
    let sequence: string | null = null;
    if (current?.kind === "text") sequence = history?.sequences.get(current.name!) ?? null;
    if (current?.kind === "list") sequence = history?.sequences.get(`${current.name}:order`) ?? null;
    const previous = document.clientID;
    document.clientID = documentAuthorId(
      canonicalJson([seed, parent, key, history?.fields.get(JSON.stringify([parent, key])) ?? null, sequence, value]),
    );
    try {
      return action();
    } finally {
      document.clientID = previous;
    }
  };
  return author;
};
