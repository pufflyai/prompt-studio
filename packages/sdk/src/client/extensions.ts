import type { RequestFn } from "./request";

export type ExtensionCollectionRow = {
  id: string;
  project_id: string;
  extension_id: string;
  scope_type: string;
  scope_id: string;
  collection: string;
  item_id: string;
  value_json: unknown;
  created_at: string;
  updated_at: string;
};

export type ExtensionClient = {
  listCollection(projectId: string, extensionId: string, collection: string): Promise<ExtensionCollectionRow[]>;
};

export const createExtensionClient = (request: RequestFn): ExtensionClient => ({
  listCollection: async (projectId, extensionId, collection) => {
    const response = await request<{ items: ExtensionCollectionRow[] }>(
      `/v1/projects/${projectId}/extensions/${encodeURIComponent(extensionId)}/collections/${encodeURIComponent(collection)}`,
    );
    return response.items;
  },
});
