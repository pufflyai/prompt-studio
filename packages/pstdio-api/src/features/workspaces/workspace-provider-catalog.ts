import type { ExtensionWorkspaceProvider } from "pstdio-api-contracts/extension-kernel";
import { apiLogger } from "../../lib/logger";
import type { WorkspacesRouteDeps } from "./deps";
import { discoverWorkspaceProvider } from "./workspace-provider-discovery";
import { catalogProviderId } from "./workspace-provider-identity";
import { findWorkspaceProvider } from "./workspace-provider-runtime";

export const listWorkspaceProviders = async (deps: WorkspacesRouteDeps, projectId: string) => {
  const providers: ExtensionWorkspaceProvider[] = [];
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  for (const entry of snapshot.runtime.workspaceTypes) {
    let params = entry.provider.params ?? {};
    if (entry.provider.discover) {
      try {
        const handle = await findWorkspaceProvider(deps, { projectId, providerId: entry.id });
        if (!handle) continue;
        const discovery = await discoverWorkspaceProvider(handle);
        if (!discovery) continue;
        params = discovery.params;
      } catch (error) {
        apiLogger.warn(
          { err: error, project_id: projectId, provider_id: entry.id },
          "Workspace provider discovery failed",
        );
        continue;
      }
    }
    providers.push({
      id: catalogProviderId(entry.id),
      label: entry.provider.label,
      icon: entry.provider.icon,
      description:
        "The provider supplies this environment and its files. Local files are not uploaded or synchronized.",
      params,
    });
  }
  return providers;
};
