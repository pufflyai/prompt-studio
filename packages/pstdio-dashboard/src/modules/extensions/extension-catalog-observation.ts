import { catalogChangeScopes } from "@/lib/extension-catalog-events";
import { getDashboardQueryClient } from "@/lib/query-client";
import { type CollectionChange, type getRuntimeCollections, subscribeCollections } from "@/lib/sync/collections";
import {
  projectCompositionChangedEventId,
  subscribeToExtensionEventFeed,
} from "@/shared/extensions/extension-webview-broadcast";
import {
  invalidateExtensionAuxiliaryQueries,
  invalidateExtensionQueries,
} from "@/shared/extensions/project-extension-cache";

export const observeProjectComposition = (
  projectId: () => string | undefined,
  owner: ReturnType<typeof getRuntimeCollections>,
  refresh: { refresh(projectId: string): void },
) =>
  subscribeToExtensionEventFeed((event) => {
    const id = projectId();
    if (event.id !== projectCompositionChangedEventId || !id || (event.projectId && event.projectId !== id)) return;
    void invalidateExtensionQueries(getDashboardQueryClient(owner), id);
    refresh.refresh(id);
  }, owner);

const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);
export const observeCatalogInvalidations = (
  projectId: () => string | undefined,
  owner: ReturnType<typeof getRuntimeCollections>,
) =>
  subscribeCollections((change) => {
    if (!change || !extensionSyncTables.has(change.table)) return;
    const id = projectId();
    const scopes = catalogChangeScopes(change);
    if (!scopes.has(undefined) && !scopes.has(id)) return;
    void invalidateExtensionAuxiliaryQueries(getDashboardQueryClient(owner), id);
  });
