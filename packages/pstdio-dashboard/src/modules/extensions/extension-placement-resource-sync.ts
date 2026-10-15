import { resourceKey, viewDataEvents } from "@pstdio/sdk/extensions";
import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { subscribeToExtensionEventFeed } from "@/shared/extensions/extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { toDashboardExtensionResource } from "./extension-kanban-adapter";

interface PlacementResourceSyncInput {
  projectId: string;
  metadata: Pick<DashboardExtensionMetadata, "resourceKinds">;
  executeCommand: ExecuteDashboardExtensionCommand;
}
// Workspace capabilities can change file access for any extension resource.
export const isResourceRefreshEvent = (id: string, extensionId: string) =>
  id.startsWith(`${extensionId}.`) || id === viewDataEvents.workspacesChanged.id;

export const refreshWorkbenchResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const placements = Object.values(ctx.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .filter((placement) => placement.resource && resourceKey(placement.resource) === resourceKey(resource));
  ctx.pages.refreshResource(resource);
  for (const placement of placements) {
    const identity = placement.placementIdentity;
    if (identity?.kind === "mode") ctx.modePlacements.updatePlacement(identity, { resource });
    if (identity?.kind === "shell") ctx.shellPlacements.updatePlacement(identity, { resource });
  }
};

export const watchExtensionPlacementResources = (ctx: WorkbenchModuleContext, input: PlacementResourceSyncInput) => {
  const pending = new Map<string, AbortController>();
  let identities = new Set<string>();
  const resources = () => {
    const result = Object.values(ctx.layout.getLayout().regions)
      .flatMap((region) => region.widgets)
      .flatMap((placement) => (placement.resource ? [placement.resource] : []));
    let location = ctx.pages.store.getState().location;
    while (location) {
      if (location.resource) result.push(location.resource);
      location = location.parent;
    }
    return result;
  };
  const applyResource = (resource: ResourceRef, result: unknown) => {
    const value = toDashboardExtensionResource(result, input.projectId, input.metadata.resourceKinds);
    if (!value) return;
    const updated = {
      ...resource,
      ...value,
      extensionId: value.extensionId ?? resource.extensionId,
      projectId: value.projectId ?? resource.projectId,
      metadata: { ...resource.metadata, ...value.metadata },
    };
    const key = resourceKey(resource);
    if (resourceKey(updated) !== key) return;
    refreshWorkbenchResource(ctx, updated);
  };
  const resolve = async (resource: ResourceRef) => {
    const kind = input.metadata.resourceKinds.find(
      (kind) => kind.id === resource.type && kind.extensionId === resource.extensionId,
    );
    if (!kind?.resolveCommand) return;
    const key = resourceKey(resource);
    pending.get(key)?.abort();
    const request = new AbortController();
    pending.set(key, request);
    try {
      const response = await input.executeCommand(
        input.projectId,
        kind.resolveCommand,
        { projectId: input.projectId, source: "dashboard", resource },
        request.signal,
      );
      if (request.signal.aborted || !resources().some((candidate) => resourceKey(candidate) === key)) return;
      if (response.outcome.status !== "success")
        throw new Error(response.outcome.reason ?? "Resource resolver failed.");
      applyResource(resource, response.outcome.value);
    } catch (error) {
      if (!request.signal.aborted) console.warn(`Could not refresh resource ${key}`, error);
    } finally {
      if (pending.get(key) === request) pending.delete(key);
    }
  };
  const sync = () => {
    const current = new Map(resources().map((resource) => [resourceKey(resource), resource]));
    for (const [key, request] of pending)
      if (!current.has(key)) {
        request.abort();
        pending.delete(key);
      }
    const added = [...current].filter(([key]) => !identities.has(key));
    identities = new Set(current.keys());
    const primary = ctx.getPrimaryResource();
    for (const [key, resource] of added) if (!primary || resourceKey(primary) !== key) void resolve(resource);
  };
  sync();
  const unsubscribeLayout = ctx.layout.store.subscribe(sync);
  const unsubscribePages = ctx.pages.store.subscribe(sync);
  const unsubscribeEvents = subscribeToExtensionEventFeed((event) => {
    if (event.projectId !== input.projectId) return;
    const primary = ctx.getPrimaryResource();
    for (const resource of new Map(resources().map((resource) => [resourceKey(resource), resource])).values()) {
      if (
        resource.extensionId &&
        isResourceRefreshEvent(event.id, resource.extensionId) &&
        (!primary || resourceKey(primary) !== resourceKey(resource))
      )
        void resolve(resource);
    }
  });
  return {
    dispose() {
      unsubscribeLayout();
      unsubscribePages();
      unsubscribeEvents();
      for (const request of pending.values()) request.abort();
    },
  };
};
