import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { createWorkbenchResourceLinksModule, type ResourceLinksService } from "@pstdio/workbench/react";
import { getRuntimeApiClient } from "@/lib/api";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import {
  subscribeToExtensionEventFeed,
  subscribeToExtensionEventReset,
} from "@/shared/extensions/extension-webview-broadcast";
import { subscribeToResourceAnchorChanges } from "@/shared/extensions/resource-anchor-feed";
import { subscribeToResourceRemovals } from "@/shared/extensions/resource-removal-feed";
import { getResourceLinkAuthority } from "./resource-link-authority";
import { createResourceLinkDependencies } from "./resource-link-dependencies";
import { linkableResource } from "./resource-link-identity";
import { getResourceLinkOperations } from "./resource-link-operations";
import { resolveLinkedResources } from "./resource-link-resolution";
import { searchLinkResources } from "./resource-link-search";

export const createResourceLinksService = (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
  owner = getRuntimeCollections(),
): ResourceLinksService => {
  const projectId = resource.projectId!;
  const dependencies = createResourceLinkDependencies(ctx, resource);
  const authority = getResourceLinkAuthority(owner)(projectId);
  const api = getRuntimeApiClient(owner).resources;
  return {
    ...getResourceLinkOperations(owner)(resource),
    retirementSignal: authority,
    async list(input) {
      authority.throwIfAborted();
      const result = await api.listAnchors(projectId, input);
      authority.throwIfAborted();
      return result;
    },
    search: (query, signal) =>
      searchLinkResources(ctx, projectId, query, signal ? AbortSignal.any([authority, signal]) : authority),
    resolve: (resources, signal) => {
      dependencies.resolved(resources);
      return resolveLinkedResources(ctx, projectId, resources, signal, owner, authority);
    },
    subscribe: (listener) => {
      const disposers = [
        ctx.pages.store.subscribe(listener),
        ctx.resources.store.subscribe(listener),
        ctx.commandPaletteResources.store.subscribe(listener),
        owner.subscribeCollections((change) => {
          if (!change) return listener();
          if (!["workspaces", "sessions", "projects", "extension_instances"].includes(change.table)) return;
          if (
            change.changes.some(({ value, previousValue }) =>
              [value, previousValue].some(
                (row) => row && (change.table === "projects" ? row.id === projectId : row.project_id === projectId),
              ),
            )
          )
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
        }, owner),
        subscribeToResourceRemovals((ref) => {
          if (ref.projectId === projectId) listener();
        }, owner),
        subscribeToExtensionEventFeed((event) => {
          if (
            event.projectId === projectId &&
            ctx.commandPaletteResources.listProviders().some((provider) => provider.refreshEventIds?.includes(event.id))
          )
            listener();
        }, owner),
        subscribeToExtensionEventReset((reset) => {
          if (dependencies.matches(reset)) listener();
        }, owner),
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
      const owner = getRuntimeCollections();
      const authorities = getResourceLinkAuthority(owner);
      const servicesByAuthority = new WeakMap<AbortSignal, Map<string, ResourceLinksService>>();
      return ctx.registerChildModule(
        createWorkbenchResourceLinksModule({
          canonicalize: (resource) => {
            const projectId = getDashboardSelectedProjectId(ctx);
            if (!projectId) return undefined;
            return linkableResource(resource, projectId);
          },
          createService: (ref) => {
            const authority = authorities(ref.projectId!);
            let services = servicesByAuthority.get(authority);
            if (!services) {
              services = new Map();
              servicesByAuthority.set(authority, services);
            }
            const key = resourceKey(ref);
            const service = services.get(key) ?? createResourceLinksService(ctx, ref, owner);
            services.set(key, service);
            return service;
          },
        }),
      );
    },
  }) satisfies WorkbenchModuleContribution;
