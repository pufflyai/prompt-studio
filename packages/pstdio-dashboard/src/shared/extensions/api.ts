import type {
  CommandExecuteResponse,
  ListProjectExtensionsResponse,
  ProjectExtensionInstance,
} from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";
import type { DashboardExtensionMetadata } from "./types";

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
