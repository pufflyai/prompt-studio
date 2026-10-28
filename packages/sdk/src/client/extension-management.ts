import type {
  CreateNotificationInput,
  ExtensionBlobRef,
  ExtensionInstallation,
  Notification,
  ProjectExtensionInstance,
  WebviewArtifactFile,
  WorkbenchExtensionAutomationRecord,
  WorkbenchExtensionMetadata,
} from "pstdio-api-contracts";
import { projectExtensionPath } from "./extension-controls";
import type { RequestFn } from "./request";

const projectPath = (projectId: string) => `/v1/projects/${encodeURIComponent(projectId)}/extensions`;
const artifactPath = (projectId: string, instanceId: string, mountId: string) =>
  `${projectExtensionPath(projectId, instanceId)}/artifacts/${encodeURIComponent(mountId)}`;
export const createExtensionManagementClient = (request: RequestFn) => ({
  installations: () => request<ExtensionInstallation[]>("/v1/extension-installations"),
  retryInstallation: (id: string) =>
    request<ExtensionInstallation>(`/v1/extension-installations/${encodeURIComponent(id)}/retry`, { method: "POST" }),
  createNotification: (projectId: string, extensionId: string, body: Omit<CreateNotificationInput, "projectId">) =>
    request<Notification>(`${projectPath(projectId)}/${encodeURIComponent(extensionId)}/notifications`, {
      method: "POST",
      body,
    }),
  metadata: (projectId: string) => request<WorkbenchExtensionMetadata>(`${projectPath(projectId)}/ui`),
  contributions: (projectId: string, instanceId: string) =>
    request<WorkbenchExtensionMetadata>(`${projectExtensionPath(projectId, instanceId)}/contributions`),
  marketplaceContributions: (projectId: string, installName: string) =>
    request<WorkbenchExtensionMetadata>(
      `${projectPath(projectId)}/marketplace/${encodeURIComponent(installName)}/contributions`,
    ),
  setEnabled: (projectId: string, instanceId: string, enabled: boolean) =>
    request<ProjectExtensionInstance>(projectExtensionPath(projectId, instanceId), {
      method: "PATCH",
      body: { enabled },
    }),
  setAutomationEnabled: (projectId: string, instanceId: string, automationId: string, enabled: boolean) =>
    request<WorkbenchExtensionAutomationRecord>(
      `${projectExtensionPath(projectId, instanceId)}/automations/${encodeURIComponent(automationId)}`,
      { method: "PATCH", body: { enabled } },
    ),
  reload: (projectId: string, instanceId: string) =>
    request<ProjectExtensionInstance>(`${projectExtensionPath(projectId, instanceId)}/reload`, { method: "POST" }),
  uninstall: (projectId: string, instanceId: string, deleteUserData = false) =>
    request<void>(`${projectExtensionPath(projectId, instanceId)}${deleteUserData ? "?deleteUserData=true" : ""}`, {
      method: "DELETE",
    }),
  uploadCommandFile: (
    projectId: string,
    commandId: string,
    input: { name: string; data: Uint8Array | ArrayBuffer; mimeType?: string },
  ) =>
    request<ExtensionBlobRef>(`${projectPath(projectId)}/commands/${encodeURIComponent(commandId)}/files`, {
      method: "POST",
      body: input.data,
      headers: {
        "content-type": input.mimeType ?? "application/octet-stream",
        "x-file-name": encodeURIComponent(input.name),
      },
    }),
  artifacts: {
    list: (projectId: string, instanceId: string, mountId: string, prefix?: string) =>
      request<{ files: WebviewArtifactFile[] }>(
        `${artifactPath(projectId, instanceId, mountId)}/files${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ""}`,
      ),
    readText: (projectId: string, instanceId: string, mountId: string, path: string) =>
      request<{ content: string }>(
        `${artifactPath(projectId, instanceId, mountId)}/text?path=${encodeURIComponent(path)}`,
      ),
    imageUrl: (projectId: string, instanceId: string, mountId: string, path: string, webviewId: string) =>
      request<{ url: string }>(
        `${artifactPath(projectId, instanceId, mountId)}/image-url?${new URLSearchParams({ path, webviewId })}`,
      ),
  },
});
