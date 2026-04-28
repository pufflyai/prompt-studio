import { createExtensionStorageDBService, createExtensionTemplatePreferencesDBService, type DbClient } from "pstdio-db";

type ExtensionStorageContextInput = {
  db: DbClient;
  projectId: string;
  extensionId: string;
  eventBus?: {
    emit(table: string, op: "set" | "delete", data: unknown): void;
  };
  scope?: {
    type: string;
    id: string;
  };
};

type ExtensionStorageApi = {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  collection(name: string): {
    list(): Promise<{ id: string; value: unknown }[]>;
    get(id: string): Promise<unknown | null>;
    put(id: string, value: unknown): Promise<void>;
    delete(id: string): Promise<void>;
  };
  templatePreferences: {
    isEnabled(templateKey: string): Promise<boolean>;
    setEnabled(templateKey: string, enabled: boolean): Promise<void>;
  };
};

export const createExtensionStorageContext = (input: ExtensionStorageContextInput) => {
  const storage = createExtensionStorageDBService(input.db);
  const preferences = createExtensionTemplatePreferencesDBService(input.db);
  const scope = {
    project_id: input.projectId,
    extension_id: input.extensionId,
    scope_type: input.scope?.type ?? "project",
    scope_id: input.scope?.id ?? "",
  };

  return {
    get: (key) => storage.get(scope, key),
    set: async (key, value) => {
      const record = await storage.set(scope, key, value);
      input.eventBus?.emit("extension_kv", "set", record);
    },
    delete: async (key) => {
      const record = await storage.delete(scope, key);
      if (record) input.eventBus?.emit("extension_kv", "delete", { id: record.id });
    },
    collection: (name) => {
      const collection = storage.collection(scope, name);

      return {
        list: collection.list,
        get: collection.get,
        put: async (id, value) => {
          const record = await collection.put(id, value);
          input.eventBus?.emit("extension_collection_items", "set", record);
        },
        delete: async (id) => {
          const record = await collection.delete(id);
          if (record) input.eventBus?.emit("extension_collection_items", "delete", { id: record.id });
        },
      };
    },
    templatePreferences: {
      isEnabled: (templateKey) => preferences.isEnabled(input.projectId, input.extensionId, templateKey),
      setEnabled: async (templateKey, enabled) => {
        await preferences.setEnabled(input.projectId, input.extensionId, templateKey, enabled);
      },
    },
  } satisfies ExtensionStorageApi;
};
