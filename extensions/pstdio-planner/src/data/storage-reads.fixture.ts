import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";

export const observeStorageReads = (storage: ExtensionStorageApi) => {
  const reads: string[] = [];
  const observed: ExtensionStorageApi = {
    ...storage,
    collection<T>(name: string) {
      const collection = storage.collection<T>(name);
      return {
        ...collection,
        async get(id: string) {
          reads.push(`${name}/${id}`);
          return collection.get(id);
        },
        async list() {
          reads.push(`${name}/*`);
          return collection.list();
        },
      };
    },
  };
  return { storage: observed, reads };
};
