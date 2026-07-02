import type { RouteDeps } from "../deps";
import type { ExtensionsRouteDeps } from "../extensions/deps";

// Provisioning workspaces requires firing extension events, so project routes
// reuse the full extension event deps plus the project-specific extras.
export type ProjectsRouteDeps = ExtensionsRouteDeps &
  Pick<RouteDeps, "extensionSettingsDBService" | "filesRoot" | "installedExtensionSourcesService" | "syncService">;
