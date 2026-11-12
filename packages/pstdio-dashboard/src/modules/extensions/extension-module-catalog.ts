import type { ListExtensionAppearanceResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { ScopedQuery, ScopedQueryClient } from "@pstdio/sdk/extensions";
import type { getRuntimeCollections } from "@/lib/sync/collections";
import { getProjectExtensionQueries } from "@/shared/extensions/project-extension-queries";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";

export interface CreateExtensionsModuleInput {
  queries?: ScopedQueryClient;
  executeCommand?: ExecuteDashboardExtensionCommand;
  loadAppearance?: (projectId: string) => Promise<ListExtensionAppearanceResponse>;
  loadMetadata?: (projectId: string) => Promise<WorkbenchExtensionMetadata>;
}

export const createExtensionModuleCatalog = (
  input: CreateExtensionsModuleInput,
  queries: ScopedQueryClient,
  owner: ReturnType<typeof getRuntimeCollections>,
) => {
  const namespace = input.loadMetadata || input.loadAppearance ? crypto.randomUUID() : undefined;
  const customReads = new Set<ScopedQuery<unknown>>();
  const catalog = (projectId: string) => {
    const result = getProjectExtensionQueries(projectId, { ...input, owner, namespace, queries });
    if (namespace) {
      customReads.add(result.metadata);
      customReads.add(result.appearance);
      for (const query of customReads) if (query.isDisposed()) customReads.delete(query);
    }
    return result;
  };
  return {
    query: catalog,
    dispose() {
      for (const query of customReads) query.dispose();
      customReads.clear();
    },
  };
};
