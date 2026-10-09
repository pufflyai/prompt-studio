import type { RouteDeps } from "../deps";
import type { WorkspaceProviderRuntime } from "./workspace-provider-runtime";

export type WorkspacesRouteDeps = Pick<
  RouteDeps,
  | "artifactMountWrites"
  | "automationService"
  | "activityEventsService"
  | "eventBus"
  | "extensionAutomationPreferencesService"
  | "extensionConnectionService"
  | "extensionFileService"
  | "extensionInstancesService"
  | "extensionRuntimeCatalog"
  | "extensionResourceSequencesService"
  | "resourceLinksService"
  | "extensionService"
  | "extensionSettingsDBService"
  | "extensionSettingsService"
  | "extensionStorageService"
  | "fileService"
  | "harnessRegistry"
  | "notificationService"
  | "projectService"
  | "workspaceService"
  | "sessionQueueEntriesService"
  | "sessionQueueLifecycle"
  | "sessionService"
  | "skillService"
  | "settingsService"
  | "workspaceService"
  | "workspaceSessionService"
> & { workspaceProviderRuntime?: WorkspaceProviderRuntime };
