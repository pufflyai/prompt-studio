import type { ExtensionTerminalApi } from "pstdio-api-contracts/extension-kernel";
import type { RouteDeps } from "../deps";
import type { ExtensionWebviewUrlIssuer } from "./extension-webview-access";

export type ExtensionsRouteDeps = Pick<
  RouteDeps,
  | "harnessRegistry"
  | "eventBus"
  | "extensionService"
  | "extensionRuntimeCatalog"
  | "extensionConnectionService"
  | "extensionSettingsDBService"
  | "extensionSettingsService"
  | "notificationService"
  | "sessionQueueEntriesService"
  | "settingsService"
  | "skillService"
  | "templateService"
  | "workspaceSessionService"
> & {
  activityEventsService: RouteDeps["activityEventsService"];
  extensionAutomationPreferencesService: RouteDeps["extensionAutomationPreferencesService"];
  extensionFileService: RouteDeps["extensionFileService"];
  extensionInstancesService: RouteDeps["extensionInstancesService"];
  extensionStorageService: RouteDeps["extensionStorageService"];
  fileService: RouteDeps["fileService"];
  projectService: RouteDeps["projectService"];
  repoService: RouteDeps["repoService"];
  sessionService: RouteDeps["sessionService"];
  workspaceService: RouteDeps["workspaceService"];
  webviewCacheRoot?: string;
  extensionUpgradeService?: RouteDeps["extensionUpgradeService"];
  /** Host PTY supervisor api; owned by the app runtime, disposed on app close. */
  terminal?: ExtensionTerminalApi;
};

export type ExtensionWebviewRouteDeps = Pick<RouteDeps, "extensionWebviewAccess">;

export interface ExtensionWebviewMetadataDeps {
  extensionWebviewAccess: ExtensionWebviewUrlIssuer;
}
