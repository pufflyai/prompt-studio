import { createDocumentStorage, createMemoryDocumentStore, type StorageOwner } from "pstdio-sync";

/** In-memory extension storage with one document store per owner, so owners never share records. */
export const createTestDocumentStorage = () => {
  const stores = new Map<string, ReturnType<typeof createMemoryDocumentStore>>();
  const storeFor = (owner: StorageOwner) => {
    const key = JSON.stringify([owner.workbenchId, owner.extensionId]);
    let store = stores.get(key);
    if (!store) {
      store = createMemoryDocumentStore();
      stores.set(key, store);
    }
    return store;
  };
  return {
    open: async (input: Omit<Parameters<typeof createDocumentStorage>[0], "store">) =>
      createDocumentStorage({ ...input, store: storeFor(input.owner) }),
  };
};
