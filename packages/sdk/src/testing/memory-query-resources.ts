import type { ExtensionResourcesApi, ExtensionStorageApi } from "pstdio-api-contracts/extension-kernel";

const readers = new WeakMap<object, Pick<ExtensionResourcesApi, "identity">>();
/** Connect fixture core resources to the storage query engine, including later identity changes. */
export const connectMemoryQueryResources = (
  storage: ExtensionStorageApi,
  resources: Pick<ExtensionResourcesApi, "identity">,
) => readers.set(storage.records.query, resources);

export const readMemoryQueryIdentity = (query: object, kind: string, id: string) =>
  readers.get(query)?.identity({ kind, id }) ?? Promise.resolve(null);
