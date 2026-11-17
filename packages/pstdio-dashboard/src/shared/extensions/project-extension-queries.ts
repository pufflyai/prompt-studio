import type { ListExtensionAppearanceResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { type ScopedQueryClient, viewDataEvents } from "@pstdio/sdk/extensions";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections, type RuntimeCollections } from "@/lib/sync/collections";

interface CatalogInput {
  namespace?: string;
  owner?: RuntimeCollections;
  queries?: ScopedQueryClient;
  loadMetadata?(projectId: string): Promise<WorkbenchExtensionMetadata>;
  loadAppearance?(projectId: string): Promise<ListExtensionAppearanceResponse>;
}

/** Raw metadata has one authority; registration and localization are derived projections. */
export const getProjectExtensionQueries = (projectId: string | undefined, input: CatalogInput = {}) => {
  const owner = input.owner ?? getRuntimeCollections();
  const client = getRuntimeApiClient(owner).extensions;
  const root = input.queries ?? getDashboardScopedQueries(owner);
  const queries = root.forScope({ projectId, extensionId: "pstdio" });
  const dependsOn = [viewDataEvents.extensionCatalogChanged.id];
  return {
    get metadata() {
      return queries.query({
        id: "extensions.metadata",
        params: input.namespace ?? null,
        dependsOn,
        read: (signal) => input.loadMetadata?.(projectId!) ?? client.metadata(projectId!, { signal }),
      });
    },
    get appearance() {
      return queries.query({
        id: "extensions.appearance",
        params: input.namespace ?? null,
        dependsOn,
        read: (signal) => input.loadAppearance?.(projectId!) ?? client.listAppearance(projectId!, { signal }),
      });
    },
    get extensions() {
      return queries.query({
        id: "extensions.list",
        dependsOn,
        read: (signal) => client.listProject(projectId!, { signal }),
      });
    },
    contributions: (instanceId?: string) =>
      queries.query({
        id: "extensions.contributions",
        params: instanceId ?? null,
        dependsOn,
        read: (signal) => client.contributions(projectId!, instanceId!, { signal }),
      }),
    marketplace: (installName?: string) =>
      queries.query({
        id: "extensions.marketplace",
        params: installName ?? null,
        dependsOn,
        read: (signal) => client.marketplaceContributions(projectId!, installName!, { signal }),
      }),
    settings: (instanceId?: string) =>
      queries.query({
        id: "extensions.settings",
        params: instanceId ?? null,
        dependsOn,
        read: (signal) => client.projectSettings.all(projectId!, instanceId!, { signal }),
      }),
  };
};
