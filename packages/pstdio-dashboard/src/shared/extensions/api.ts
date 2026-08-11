import type {
  AttemptExtensionFixResponse,
  CommandExecuteResponse,
  ExtensionSettingValueRecord,
  ListExtensionAppearanceResponse,
  ListProjectExtensionsResponse,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import { apiRequest } from "@/lib/api";
import type { DashboardExtensionMetadata } from "./types";

export const getProjectExtensionMetadata = (projectId: string) =>
  apiRequest<DashboardExtensionMetadata>(`/v1/projects/${projectId}/extensions/ui`);

export const getExtensionContributions = (projectId: string, instanceId: string) =>
  apiRequest<DashboardExtensionMetadata>(`/v1/projects/${projectId}/extensions/${instanceId}/contributions`);

export const getProjectExtensionAppearance = (projectId: string) =>
  apiRequest<ListExtensionAppearanceResponse>(`/v1/projects/${projectId}/extensions/appearance`);

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

export const setExtensionAutomationEnabled = (
  projectId: string,
  instanceId: string,
  automationId: string,
  enabled: boolean,
) =>
  apiRequest<WorkbenchExtensionAutomationRecord>(
    `/v1/projects/${projectId}/extensions/${instanceId}/automations/${encodeURIComponent(automationId)}`,
    { method: "PATCH", body: { enabled } },
  );

export const reloadProjectExtension = (projectId: string, instanceId: string) =>
  apiRequest<ProjectExtensionInstance>(`/v1/projects/${projectId}/extensions/${instanceId}/reload`, {
    method: "POST",
  });

export const attemptExtensionFix = (projectId: string, instanceId: string) =>
  apiRequest<AttemptExtensionFixResponse>(`/v1/projects/${projectId}/extensions/${instanceId}/attempt-fix`, {
    method: "POST",
  });

export const uninstallProjectExtension = (projectId: string, instanceId: string, deleteUserData = false) =>
  apiRequest<void>(
    `/v1/projects/${projectId}/extensions/${instanceId}${deleteUserData ? "?deleteUserData=true" : ""}`,
    { method: "DELETE" },
  );

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
