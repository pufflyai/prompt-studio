import { canonicalJson, type Json } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import type { DocumentHistory } from "../shared";
import { documentAuthorId } from "../shared";

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
