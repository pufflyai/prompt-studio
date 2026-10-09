import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { createWorkbenchResourceLinksModule, type ResourceLinksService } from "@pstdio/workbench/react";
import { getApiClient } from "@/lib/api";
import { subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import {
  subscribeToExtensionEventFeed,
  subscribeToExtensionEventReset,
} from "@/shared/extensions/extension-webview-broadcast";
import { subscribeToResourceAnchorChanges } from "@/shared/extensions/resource-anchor-feed";
import { subscribeToResourceRemovals } from "@/shared/extensions/resource-removal-feed";
import { linkableResource } from "./resource-link-identity";
import { resolveLinkedResources } from "./resource-link-resolution";
import { searchLinkResources } from "./resource-link-search";

export const createResourceLinksService = (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
): ResourceLinksService => {
  const projectId = resource.projectId!;
  const api = () => getApiClient().resources;
  return {
    list: (input) => api().listAnchors(projectId, input),
    add: (source, targets) => api().addAnchors(projectId, source, targets),
    remove: (source, targets) => api().removeAnchors(projectId, source, targets),
    search: (query, signal) => searchLinkResources(ctx, projectId, query, signal),
    resolve: (resources, signal) => resolveLinkedResources(ctx, projectId, resources, signal),
    subscribe: (listener) => {
      const disposers = [
        ctx.pages.store.subscribe(listener),
        ctx.resources.store.subscribe(listener),
        ctx.commandPaletteResources.store.subscribe(listener),
        subscribeCollections((change) => {
          if (change && ["workspaces", "sessions", "projects", "extension_instances"].includes(change.table))
            listener();
        }),
        subscribeToResourceAnchorChanges((event) => {
          if (
            event.projectId === projectId &&
            event.items.some(
              (edge) =>
                resourceKey(edge.source) === resourceKey(resource) ||
                resourceKey(edge.target) === resourceKey(resource),
            )
          )
            listener();
        }),
        subscribeToResourceRemovals((ref) => {
          if (ref.projectId === projectId) listener();
        }),
        subscribeToExtensionEventFeed((event) => {
          if (
            event.projectId === projectId &&
            ctx.commandPaletteResources.listProviders().some((provider) => provider.refreshEventIds?.includes(event.id))
          )
            listener();
        }),
        subscribeToExtensionEventReset(listener),
      ];
      return () => {
        for (const dispose of disposers) dispose();
      };
    },
  };
};

export const createResourceLinksModule = () =>
  ({
    id: "dashboard.resource-links",
    activate(ctx) {
      const services = new Map<string, ResourceLinksService>();
      return ctx.registerChildModule(
        createWorkbenchResourceLinksModule({
          canonicalize: (resource) => {
            const projectId = getDashboardSelectedProjectId(ctx);
            if (!projectId) return undefined;
            return linkableResource(resource, projectId);
          },
          createService: (ref) => {
            const key = resourceKey(ref);
            const service = services.get(key) ?? createResourceLinksService(ctx, ref);
            services.set(key, service);
            return service;
          },
        }),
      );
    },
  }) satisfies WorkbenchModuleContribution;
