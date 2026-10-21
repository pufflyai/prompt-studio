import type * as Y from "yjs";

export interface LoadedDocument {
  revision: number;
  document: Y.Doc;
}
export const createDocumentCache = () => {
  const entries = new Map<string, LoadedDocument>();
  const discard = (key: string) => {
    entries.get(key)?.document.destroy();
    entries.delete(key);
  };
  return {
    get: (key: string) => entries.get(key),
    discard,
    publish(key: string, entry: LoadedDocument) {
      const previous = entries.get(key);
      if (previous && previous.document !== entry.document) previous.document.destroy();
      entries.delete(key);
      entries.set(key, entry);
      if (entries.size > 32) discard(entries.keys().next().value!);
    },
  };
};
