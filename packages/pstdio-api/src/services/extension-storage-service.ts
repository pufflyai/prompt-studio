import type { createExtensionStorageDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

type ExtensionStorageServiceDeps = {
  eventBus: EventBus;
  extensionStorageDBService: ReturnType<typeof createExtensionStorageDBService>;
};

type ExtensionStorageCollectionInput = {
  projectId: string;
  extensionId: string;
  collection: string;
  scopeType?: string;
  scopeId?: string;
};

const toScope = (input: Omit<ExtensionStorageCollectionInput, "collection">) => ({
  project_id: input.projectId,
  extension_id: input.extensionId,
  scope_type: input.scopeType ?? "project",
  scope_id: input.scopeId ?? "",
});

export const createExtensionStorageService = (deps: ExtensionStorageServiceDeps) => {
  const collection = (input: ExtensionStorageCollectionInput) => {
    const storage = deps.extensionStorageDBService.collection(toScope(input), input.collection);

    const put = async (itemId: string, value: unknown) => {
      const record = await storage.put(itemId, value);
      deps.eventBus.emit("extension_collection_items", "set", record);
      return record;
    };

    const deleteItem = async (itemId: string) => {
      const record = await storage.delete(itemId);
      if (record) deps.eventBus.emit("extension_collection_items", "delete", { id: record.id });
      return record;
    };

    return {
      list: storage.listRecords,
      listValues: storage.list,
      get: storage.get,
      put,
      delete: deleteItem,
    };
  };

  return { collection };
};
