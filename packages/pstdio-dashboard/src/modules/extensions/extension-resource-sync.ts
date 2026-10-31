import { isNavigationTarget, type PageLocation, type ResourceResolution } from "@pstdio/sdk/extensions";
import type { Disposable, ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { qualifyNavigationTarget } from "pstdio-api-contracts";
import {
  subscribeToExtensionEventFeed,
  subscribeToExtensionEventReset,
} from "@/shared/extensions/extension-webview-broadcast";
import { canonicalDashboardResource } from "@/shared/extensions/resource-identity";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { toDashboardExtensionResource } from "./extension-kanban-adapter";
import {
  isResourceRefreshEvent,
  refreshWorkbenchResource,
  watchExtensionPlacementResources,
} from "./extension-placement-resource-sync";
import { resolutionFromResult, resourceResolutionRequest } from "./extension-resource-resolution";

interface WatchOpenExtensionResourceInput {
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: Pick<DashboardExtensionMetadata, "resourceKinds">;
  projectId: string;
}

const sameReference = (left: ResourceRef, right: ResourceRef) =>
  left.extensionId === right.extensionId &&
  left.projectId === right.projectId &&
  left.label === right.label &&
  left.icon === right.icon &&
  left.shorthand === right.shorthand &&
  JSON.stringify(left.metadata ?? {}) === JSON.stringify(right.metadata ?? {});

const ownerPageTarget = (input: {
  target?: ResourceResolution["target"];
  extensionId: string;
  projectId: string;
  location?: PageLocation;
}) => {
  if (!input.target || !input.location || !isNavigationTarget(input.target)) return undefined;
  const target = qualifyNavigationTarget(input.target, input.extensionId, input.projectId);
  if (
    target.kind !== "page" ||
    target.page.id !== input.location.page.id ||
    target.page.extensionId !== input.location.page.extensionId
  )
    return undefined;
  return target;
};

// A page keeps the reference captured when it opened, and a pasted link carries only the
// identity. The owning extension knows the current reference, so the host asks it again
// when another resource opens and after the extension reports a change. Replaying the
// page does not change the identity, so it never triggers another request.
export const watchOpenExtensionResource = (
  ctx: WorkbenchModuleContext,
  input: WatchOpenExtensionResourceInput,
): Disposable => {
  const resolvers = new Map(
    input.metadata.resourceKinds.flatMap((kind) =>
      (kind.resolveCommand ?? kind.resolveManyCommand)
        ? [
            [
              JSON.stringify([kind.extensionId, kind.localId]),
              {
                commandId: (kind.resolveCommand ?? kind.resolveManyCommand)!,
                extensionId: kind.extensionId,
                batch: !kind.resolveCommand,
              },
            ] as const,
          ]
        : [],
    ),
  );
  const resolverOf = (resource: ResourceRef | undefined) => {
    if (!resource) return undefined;
    if (resource.extensionId) return resolvers.get(JSON.stringify([resource.extensionId, resource.type]));
    const ref = canonicalDashboardResource(resource, input.projectId, input.metadata.resourceKinds);
    return ref.extensionId ? resolvers.get(JSON.stringify([ref.extensionId, ref.type])) : undefined;
  };
  const identityOf = (resource: ResourceRef | undefined) =>
    resource
      ? JSON.stringify([
          resource.projectId ?? input.projectId,
          resource.extensionId ?? resolverOf(resource)?.extensionId,
          resource.type,
          resource.id,
        ])
      : undefined;
  const documentKey = () => {
    const state = ctx.pages.store.getState();
    return state.activePageId ? state.pages[state.activePageId]?.document?.metadataKey : undefined;
  };
  const routeOf = (resource: ResourceRef | undefined) => {
    const page = ctx.pages.store.getState().location?.page;
    const key = documentKey();
    return JSON.stringify([identityOf(resource), page, key ? resource?.metadata?.[key] : undefined]);
  };
  let openIdentity: string | undefined;
  let pending: AbortController | undefined;

  const applyResolution = (
    value: unknown,
    open: ResourceRef,
    resolver: NonNullable<ReturnType<typeof resolverOf>>,
    route: string,
  ) => {
    const resolution = resolutionFromResult(value, { batch: resolver.batch, identityOf, open });
    const latest = ctx.getPrimaryResource();
    if (!latest || routeOf(latest) !== route) return;
    if (!resolver.batch && value === null) {
      ctx.resources.removed(latest);
      return;
    }
    const resolved = toDashboardExtensionResource(resolution?.resource, input.projectId, input.metadata.resourceKinds);
    if (!resolved || routeOf({ ...resolved, extensionId: resolved.extensionId ?? resolver.extensionId }) !== route)
      return;
    // The resolver describes the resource; the open page keeps its identity and route.
    const current = {
      ...canonicalDashboardResource(latest, input.projectId, input.metadata.resourceKinds),
      label: resolved.label,
      icon: resolved.icon,
      shorthand: resolved.shorthand,
      metadata: resolved.metadata,
    };
    refreshWorkbenchResource(ctx, current);
    const location = ctx.pages.store.getState().location;
    const target = ownerPageTarget({
      target: resolution && "target" in resolution ? resolution.target : undefined,
      extensionId: resolver.extensionId,
      projectId: input.projectId,
      location,
    });
    if (target && location && routeOf(target.resource) === route) {
      // The owner supplies ancestry. The current location keeps its source position and page state.
      ctx.pageLocations.replay({ ...location, resource: current, parent: target.parent });
    } else if (!sameReference(latest, current)) {
      setResourceBreadcrumb(ctx, current);
    }
  };

  const resolveOpenResource = async () => {
    pending?.abort();
    pending = undefined;
    const open = ctx.getPrimaryResource();
    const resolver = resolverOf(open);
    if (!open || !resolver) return;
    const route = routeOf(open);
    const request = new AbortController();
    pending = request;
    try {
      const response = await input.executeCommand(
        input.projectId,
        resolver.commandId,
        resourceResolutionRequest(input.projectId, open, resolver.batch),
        request.signal,
      );
      if (request.signal.aborted) return;
      if (response.outcome.status !== "success") throw new Error(response.outcome.reason ?? "Resolver failed.");
      applyResolution(response.outcome.value, open, resolver, route);
    } catch (error) {
      if (request.signal.aborted) return;
      console.warn(`Could not resolve ${identityOf(open)} with ${resolver.commandId}`, error);
    }
  };

  const onPrimaryResourceChange = () => {
    const identity = routeOf(ctx.getPrimaryResource());
    if (identity === openIdentity) return;
    openIdentity = identity;
    void resolveOpenResource();
  };

  onPrimaryResourceChange();
  const primarySubscription = ctx.onDidChangePrimaryResource(onPrimaryResourceChange);
  const unsubscribePages = ctx.pages.store.subscribe(onPrimaryResourceChange);
  const unsubscribeEvents = subscribeToExtensionEventFeed((event) => {
    const open = ctx.getPrimaryResource();
    const resolver = resolverOf(open);
    if (event.projectId !== input.projectId || !resolver) return;
    if (isResourceRefreshEvent(event.id, resolver.extensionId)) void resolveOpenResource();
  });
  const placementResources = watchExtensionPlacementResources(ctx, input);
  const unsubscribeReset = subscribeToExtensionEventReset(() => {
    void resolveOpenResource();
  });
  return {
    dispose() {
      placementResources.dispose();
      pending?.abort();
      primarySubscription.dispose();
      unsubscribePages();
      unsubscribeEvents();
      unsubscribeReset();
    },
  };
};
