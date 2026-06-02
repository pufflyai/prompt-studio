import type {
  CommandExecuteResponse,
  ExtensionSettingValueRecord,
  ListProjectExtensionsResponse,
  ProjectExtensionInstance,
} from "@pstdio/sdk/api";
import { apiRequest } from "@/lib/api";
import type { DashboardExtensionMetadata } from "./types";

export type ExtensionFileScope =
  | { type: "project" }
  | { type: "repo"; id: string }
  | { type: "resource"; id: string }
  | { type: string; id?: string };

export interface ExtensionBlobRef {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  hash: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export const getProjectExtensionMetadata = (projectId: string) =>
  apiRequest<DashboardExtensionMetadata>(`/v1/projects/${projectId}/extensions/ui`);

export const executeExtensionCommand = (projectId: string, commandId: string, body: unknown) =>
  apiRequest<CommandExecuteResponse>(
    `/v1/projects/${projectId}/extensions/commands/${encodeURIComponent(commandId)}/execute`,
    {
      method: "POST",
      body,
    },
  );

export const listProjectExtensions = (projectId: string) =>
  apiRequest<ListProjectExtensionsResponse>(`/v1/projects/${projectId}/extensions`);

export const setProjectExtensionEnabled = (projectId: string, instanceId: string, enabled: boolean) =>
  apiRequest<ProjectExtensionInstance>(`/v1/projects/${projectId}/extensions/${instanceId}`, {
    method: "PATCH",
    body: { enabled },
  });

export const uninstallProjectExtension = (projectId: string, instanceId: string) =>
  apiRequest<void>(`/v1/projects/${projectId}/extensions/${instanceId}`, { method: "DELETE" });

export const listProjectExtensionSettings = (projectId: string, instanceId: string) =>
  apiRequest<{ settings: ExtensionSettingValueRecord[] }>(
    `/v1/projects/${projectId}/extensions/${instanceId}/settings`,
  );

export const getProjectExtensionSetting = (projectId: string, instanceId: string, key: string) =>
  apiRequest<ExtensionSettingValueRecord>(
    `/v1/projects/${projectId}/extensions/${instanceId}/settings/${encodeURIComponent(key)}`,
  );

export const updateProjectExtensionSetting = (projectId: string, instanceId: string, key: string, value: unknown) =>
  apiRequest<ExtensionSettingValueRecord>(
    `/v1/projects/${projectId}/extensions/${instanceId}/settings/${encodeURIComponent(key)}`,
    { method: "PUT", body: { value } },
  );

export const deleteProjectExtensionSetting = (projectId: string, instanceId: string, key: string) =>
  apiRequest<void>(`/v1/projects/${projectId}/extensions/${instanceId}/settings/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });

export const listGlobalExtensionSettings = (installName: string) =>
  apiRequest<{ settings: ExtensionSettingValueRecord[] }>(
    `/v1/extensions/installed/${encodeURIComponent(installName)}/settings`,
  );

export const getGlobalExtensionSetting = (installName: string, key: string) =>
  apiRequest<ExtensionSettingValueRecord>(
    `/v1/extensions/installed/${encodeURIComponent(installName)}/settings/${encodeURIComponent(key)}`,
  );

export const updateGlobalExtensionSetting = (installName: string, key: string, value: unknown) =>
  apiRequest<ExtensionSettingValueRecord>(
    `/v1/extensions/installed/${encodeURIComponent(installName)}/settings/${encodeURIComponent(key)}`,
    { method: "PUT", body: { value } },
  );

export const deleteGlobalExtensionSetting = (installName: string, key: string) =>
  apiRequest<void>(`/v1/extensions/installed/${encodeURIComponent(installName)}/settings/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });

const buildExtensionFilesPath = (projectId: string, instanceId: string, scope?: ExtensionFileScope) => {
  const params = new URLSearchParams();
  if (scope) {
    params.set("scope_type", scope.type);
    if ("id" in scope && scope.id) params.set("scope_id", scope.id);
  }
  const query = params.toString();
  return `/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(instanceId)}/files${query ? `?${query}` : ""}`;
};

const toArrayBufferBody = (data: Uint8Array | ArrayBuffer) => {
  if (data instanceof ArrayBuffer) return data;
  const body = new Uint8Array(data.byteLength);
  body.set(data);
  return body.buffer;
};

export const uploadExtensionFile = async (
  projectId: string,
  instanceId: string,
  input: { name: string; data: Uint8Array | ArrayBuffer; mimeType?: string; scope?: ExtensionFileScope },
) => {
  return apiRequest<ExtensionBlobRef>(buildExtensionFilesPath(projectId, instanceId, input.scope), {
    method: "POST",
    headers: {
      "content-type": input.mimeType ?? "application/octet-stream",
      "x-file-name": encodeURIComponent(input.name),
    },
    body: toArrayBufferBody(input.data),
  });
};

export const listExtensionFiles = (projectId: string, instanceId: string, scope?: ExtensionFileScope) =>
  apiRequest<{ files: ExtensionBlobRef[] }>(buildExtensionFilesPath(projectId, instanceId, scope));

export const deleteExtensionFile = (projectId: string, instanceId: string, fileId: string) =>
  apiRequest<void>(
    `/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(instanceId)}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
