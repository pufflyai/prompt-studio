import { resourceKey, viewDataEvents } from "@pstdio/sdk/extensions";
import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import {
  subscribeToExtensionEventFeed,
  subscribeToExtensionEventReset,
} from "@/shared/extensions/extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { toDashboardExtensionResource } from "./extension-kanban-adapter";
import { resolutionFromResult, resourceResolutionRequest } from "./extension-resource-resolution";

interface PlacementResourceSyncInput {
  projectId: string;
  metadata: Pick<DashboardExtensionMetadata, "resourceKinds">;
  executeCommand: ExecuteDashboardExtensionCommand;
}
// Workspace capabilities can change file access for any extension resource.
export const isResourceRefreshEvent = (id: string, extensionId: string) =>
  id.startsWith(`${extensionId}.`) || id === viewDataEvents.workspacesChanged.id;

const resolvedPlacementResource = (value: unknown, resource: ResourceRef, batch: boolean) =>
  resolutionFromResult(value, {
    batch,
    open: resource,
    identityOf: (candidate) =>
      candidate
        ? resourceKey({
            ...candidate,
            extensionId: candidate.extensionId ?? resource.extensionId,
            projectId: candidate.projectId ?? resource.projectId,
          })
        : undefined,
  })?.resource;

export const refreshWorkbenchResource = (ctx: WorkbenchModuleContext, resource: ResourceRef) => {
  const referenceKey = ctx.pages.resourceReferenceKey;
  const placements = Object.values(ctx.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .filter((placement) => placement.resource && referenceKey(placement.resource) === referenceKey(resource));
  ctx.pages.refreshResource(resource);
  for (const placement of placements) {
    const identity = placement.placementIdentity;
    const updated = {
      ...placement.resource,
      ...resource,
      metadata: { ...placement.resource?.metadata, ...resource.metadata },
    };
    if (identity?.kind === "mode") ctx.modePlacements.updatePlacement(identity, { resource: updated });
    if (identity?.kind === "shell") ctx.shellPlacements.updatePlacement(identity, { resource: updated });
  }
};

export const watchExtensionPlacementResources = (ctx: WorkbenchModuleContext, input: PlacementResourceSyncInput) => {
  const referenceKey = ctx.pages.resourceReferenceKey;
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
    // The primary watcher owns refreshes as soon as a placement becomes the page resource.
    const primary = ctx.getPrimaryResource();
    const primaryKey = primary ? referenceKey(primary) : undefined;
    return result.filter((resource) => referenceKey(resource) !== primaryKey);
  };
  const applyResource = (resource: ResourceRef, result: unknown) => {
    if (result === null) {
      ctx.resources.removed(resource);
      return;
    }
    const value = toDashboardExtensionResource(result, input.projectId, input.metadata.resourceKinds);
    if (!value) return;
    const updated = {
      ...resource,
      ...value,
      extensionId: value.extensionId ?? resource.extensionId,
      projectId: value.projectId ?? resource.projectId,
      metadata: { ...resource.metadata, ...value.metadata },
    };
    const key = referenceKey(resource);
    if (referenceKey(updated) !== key) return;
    refreshWorkbenchResource(ctx, updated);
  };
  const resolve = async (resource: ResourceRef) => {
    const kind = input.metadata.resourceKinds.find(
      (kind) => kind.localId === resource.type && kind.extensionId === resource.extensionId,
    );
    if (!kind) return;
    const command = kind.resolveCommand ?? kind.resolveManyCommand;
    if (!command) return;
    const key = referenceKey(resource);
    pending.get(key)?.abort();
    const request = new AbortController();
    pending.set(key, request);
    try {
      const response = await input.executeCommand(
        input.projectId,
        command,
        resourceResolutionRequest(input.projectId, resource, !kind.resolveCommand),
        request.signal,
      );
      if (request.signal.aborted || !resources().some((candidate) => referenceKey(candidate) === key)) return;
      if (response.outcome.status !== "success")
        throw new Error(response.outcome.reason ?? "Resource resolver failed.");
      applyResource(resource, resolvedPlacementResource(response.outcome.value, resource, !kind.resolveCommand));
    } catch (error) {
      if (!request.signal.aborted) console.warn(`Could not refresh resource ${key}`, error);
    } finally {
      if (pending.get(key) === request) pending.delete(key);
    }
  };
  const sync = () => {
    const current = new Map(resources().map((resource) => [referenceKey(resource), resource]));
    for (const [key, request] of pending)
      if (!current.has(key)) {
        request.abort();
        pending.delete(key);
      }
    const added = [...current].filter(([key]) => !identities.has(key));
    identities = new Set(current.keys());
    for (const [, resource] of added) void resolve(resource);
  };
  sync();
  const unsubscribeLayout = ctx.layout.store.subscribe(sync);
  const unsubscribePages = ctx.pages.store.subscribe(sync);
  const primarySubscription = ctx.onDidChangePrimaryResource(sync);
  const unsubscribeEvents = subscribeToExtensionEventFeed((event) => {
    if (event.projectId !== input.projectId) return;
    for (const resource of new Map(resources().map((resource) => [referenceKey(resource), resource])).values()) {
      if (resource.extensionId && isResourceRefreshEvent(event.id, resource.extensionId)) void resolve(resource);
    }
  });
  const unsubscribeReset = subscribeToExtensionEventReset(() => {
    for (const resource of new Map(resources().map((resource) => [referenceKey(resource), resource])).values())
      void resolve(resource);
  });
  return {
    dispose() {
      unsubscribeLayout();
      unsubscribePages();
      primarySubscription.dispose();
      unsubscribeEvents();
      unsubscribeReset();
      for (const request of pending.values()) request.abort();
    },
  };
};
