import type { ExtensionWorkspaceProvider } from "pstdio-api-contracts/extension-kernel";
import { apiLogger } from "../../lib/logger";
import type { WorkspacesRouteDeps } from "./deps";
import { discoverWorkspaceProvider } from "./workspace-provider-discovery";
import { catalogProviderId } from "./workspace-provider-identity";
import { findWorkspaceProvider } from "./workspace-provider-runtime";

export const listWorkspaceProviders = async (deps: WorkspacesRouteDeps, projectId: string) => {
  const providers: ExtensionWorkspaceProvider[] = [];
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const installed = await Promise.all(
    snapshot.runtime.workspaceTypes.map(async (entry) => {
      let params = entry.provider.params ?? {};
      if (entry.provider.discover) {
        try {
          const handle = await findWorkspaceProvider(deps, { projectId, providerId: entry.id });
          if (!handle) return null;
          const discovery = await discoverWorkspaceProvider(handle);
          if (!discovery) return null;
          params = discovery.params;
        } catch (error) {
          apiLogger.error(
            { err: error, project_id: projectId, provider_id: entry.id },
            "Workspace provider discovery failed",
          );
          return null;
        }
      }
      return {
        id: catalogProviderId(entry.id),
        label: entry.provider.label,
        icon: entry.provider.icon,
        description:
          "The provider supplies this environment and its files. Local files are not uploaded or synchronized.",
        params,
      } satisfies ExtensionWorkspaceProvider;
    }),
  );
  for (const provider of installed) if (provider) providers.push(provider);
  return providers;
};
