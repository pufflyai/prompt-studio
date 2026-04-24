import { createExtensionStorageDBService, createExtensionTemplatePreferencesDBService, type DbClient } from "pstdio-db";

type ExtensionStorageContextInput = {
  db: DbClient;
  projectId: string;
  extensionId: string;
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
    set: (key, value) => storage.set(scope, key, value),
    delete: (key) => storage.delete(scope, key),
    collection: (name) => storage.collection(scope, name),
    templatePreferences: {
      isEnabled: (templateKey) => preferences.isEnabled(input.projectId, input.extensionId, templateKey),
      setEnabled: async (templateKey, enabled) => {
        await preferences.setEnabled(input.projectId, input.extensionId, templateKey, enabled);
      },
    },
  } satisfies ExtensionStorageApi;
};
