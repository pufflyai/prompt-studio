import { createDocumentStorage, createMemoryDocumentStore, type DocumentStore, type StorageOwner } from "pstdio-sync";

export const createTestDocumentStorage = () => {
  const documents = new Map<string, ReturnType<typeof createMemoryDocumentStore>>();
  const storeFor = (owner: StorageOwner, documentId: string) => {
    const key = JSON.stringify([owner.workbenchId, owner.extensionId, documentId]);
    let store = documents.get(key);
    if (!store) {
      store = createMemoryDocumentStore();
      documents.set(key, store);
    }
    return store;
  };
  return {
    documents: {
      open: (documentId: string) => {
        const transaction: DocumentStore["transaction"] = (owner, action) =>
          storeFor(owner, documentId).transaction(owner, action);
        return { transaction };
      },
    },
    open: async (input: Omit<Parameters<typeof createDocumentStorage>[0], "store">) => {
      const { owner } = input;
      return createDocumentStorage({ ...input, store: storeFor(owner, "records") });
    },
  };
};
