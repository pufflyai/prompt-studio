import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";

const definitions = "workspace-status-definitions";
const initialized = "workspace-status-definitions-initialized";
const values = "workspace-status-values";

export const cleanupLegacyWorkspaceStatus = async (storage: ExtensionStorageApi) => {
  const definitionCollection = storage.collection<{ id: string }>(definitions);
  const valueCollection = storage.collection<{ workspaceId: string }>(values);
  for (const definition of await definitionCollection.list()) await definitionCollection.delete(definition.id);
  for (const value of await valueCollection.list()) await valueCollection.delete(value.workspaceId);
  await storage.delete(initialized);
};
