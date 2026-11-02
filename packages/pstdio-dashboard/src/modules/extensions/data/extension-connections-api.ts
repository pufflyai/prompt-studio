import type { ConfigureExtensionConnectionInput } from "@pstdio/sdk/api";
import { getApiClient } from "@/lib/api";
export const listExtensionConnections = (projectId: string) => getApiClient().extensions.listConnections(projectId);
export const configureExtensionConnection = (
  projectId: string,
  extensionId: string,
  connectionId: string,
  input: ConfigureExtensionConnectionInput,
) => getApiClient().extensions.configureConnection(projectId, extensionId, connectionId, input);
export const checkExtensionConnection = (projectId: string, extensionId: string, connectionId: string) =>
  getApiClient().extensions.checkConnection(projectId, extensionId, connectionId);
export const deleteExtensionConnection = (projectId: string, extensionId: string, connectionId: string) =>
  getApiClient().extensions.deleteConnection(projectId, extensionId, connectionId);
