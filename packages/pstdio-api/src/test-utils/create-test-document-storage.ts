import { createDocumentStorage, createMemoryDocumentStore } from "pstdio-sync";

export const createTestDocumentStorage = () => {
  const documents = new Map<string, ReturnType<typeof createMemoryDocumentStore>>();
  return {
    open: async (input: Omit<Parameters<typeof createDocumentStorage>[0], "store">) => {
      const { owner } = input;
      const key = JSON.stringify([owner.workbenchId, owner.extensionId]);
      let store = documents.get(key);
      if (!store) {
        store = createMemoryDocumentStore();
        documents.set(key, store);
      }
      return createDocumentStorage({ ...input, store });
    },
  };
};
