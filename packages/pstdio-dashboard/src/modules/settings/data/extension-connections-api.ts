import type { ConfigureExtensionConnectionInput, ExtensionConnectionRecord } from "@pstdio/sdk/api";
import { apiRequest } from "@/lib/api";

const connectionPath = (projectId: string, extensionId: string, connectionId: string) =>
  `/v1/projects/${projectId}/extension-connections/${encodeURIComponent(extensionId)}/${encodeURIComponent(connectionId)}`;

export const listExtensionConnections = (projectId: string) =>
  apiRequest<{ connections: ExtensionConnectionRecord[] }>(`/v1/projects/${projectId}/extension-connections`);

export const configureExtensionConnection = (
  projectId: string,
  extensionId: string,
  connectionId: string,
  input: ConfigureExtensionConnectionInput,
) =>
  apiRequest<ExtensionConnectionRecord>(connectionPath(projectId, extensionId, connectionId), {
    method: "PUT",
    body: input,
  });

export const checkExtensionConnection = (projectId: string, extensionId: string, connectionId: string) =>
  apiRequest<ExtensionConnectionRecord>(`${connectionPath(projectId, extensionId, connectionId)}/check`, {
    method: "POST",
  });

export const deleteExtensionConnection = (projectId: string, extensionId: string, connectionId: string) =>
  apiRequest<void>(connectionPath(projectId, extensionId, connectionId), { method: "DELETE" });
