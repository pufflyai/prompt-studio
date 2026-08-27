import type { RouteDeps } from "../deps";
import type { WorkspaceProviderRuntime } from "./workspace-provider-runtime";

export type WorkspacesRouteDeps = Pick<
  RouteDeps,
  | "activityEventsService"
  | "eventBus"
  | "extensionAutomationPreferencesService"
  | "extensionConnectionService"
  | "extensionFileService"
  | "extensionInstancesService"
  | "extensionRuntimeCatalog"
  | "extensionService"
  | "extensionSettingsDBService"
  | "extensionSettingsService"
  | "extensionStorageService"
  | "fileService"
  | "harnessRegistry"
  | "notificationService"
  | "projectService"
  | "repoService"
  | "sessionQueueEntriesService"
  | "sessionService"
  | "skillService"
  | "settingsService"
  | "templateService"
  | "workspaceService"
  | "workspaceSessionService"
> & { workspaceProviderRuntime?: WorkspaceProviderRuntime };
