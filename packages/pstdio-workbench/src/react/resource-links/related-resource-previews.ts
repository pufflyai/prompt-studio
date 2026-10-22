import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { NavigationTarget, RegisteredResourceKind, WorkbenchModuleContext } from "../../core";
import { relatedResourcePageKey, relatedResourceStateKey } from "./related-resource-page-key";
import { createRelatedResourcePreferences } from "./related-resource-preferences";
import { resolveRelatedOpenings } from "./related-resource-resolution";
import type { WorkbenchResourceLinksOptions } from "./resource-links-module";
import { createResourcePreviewOpener } from "./resource-preview-opener";

export const openRelatedResourcesPreference = "workbench.openRelatedResources";
const targetResource = (target: NavigationTarget): ResourceRef | undefined => {
  if (target.kind === "compound") return target.targets.map(targetResource).find(Boolean);
  return target.kind === "page" || target.kind === "panel" ? target.resource : undefined;
};

interface RelatedLookup {
  resource: ResourceRef;
  owner: RegisteredResourceKind;
  controller: AbortController;
  removed: Set<string>;
  promise: Promise<void>;
}

export const registerRelatedResourcePreviews = (
  ctx: WorkbenchModuleContext,
  options: WorkbenchResourceLinksOptions,
) => {
  const schema = ctx.preferences.registerSchema({
    properties: { [openRelatedResourcesPreference]: { type: "boolean", scope: "user", default: true } },
  });
  const opener = createResourcePreviewOpener(ctx);
  const canonicalize = (source: ResourceRef) =>
    options.canonicalize(source) ?? (source.projectId && source.extensionId ? source : undefined);
  const pending = new Map<string, RelatedLookup>();
  const abortAll = () => {
    for (const { controller } of pending.values()) controller.abort();
  };
  const requestKey = (sourceKey: string | undefined) => JSON.stringify([relatedResourcePageKey(ctx), sourceKey]);
  const cancelOtherSelections = (selectedKey?: string) => {
    const source = ctx.pages.store.getState().location?.resource;
    const pageResource = source && canonicalize(source);
    for (const [key, { controller }] of pending) {
      if (selectedKey && key === requestKey(selectedKey)) continue;
      // A manual panel selection must not discard the routed page's declaration
      // lookup: its result still determines which user choices belong to the page.
      if (key !== requestKey(resourceKey(pageResource))) controller.abort();
    }
  };
  let openingPreviews = false;
  let disposed = false;
  const preferences = createRelatedResourcePreferences(ctx, canonicalize);
  const enabled = () => ctx.preferences.getValue(openRelatedResourcesPreference) !== false;
  const load = async (request: RelatedLookup, present: boolean) => {
    const { resource, owner, controller, removed } = request;
    const pageKey = relatedResourcePageKey(ctx);
    const available = (target: ResourceRef) => !removed.has(resourceKey(target));
    const current = () =>
      !controller.signal.aborted &&
      enabled() &&
      relatedResourcePageKey(ctx) === pageKey &&
      ctx.resources.getKind(resource.type, resource.extensionId) === owner;
    try {
      const entries = await owner.relatedOpenings!(resource, controller.signal);
      if (!current()) return;
      const defaults = entries.filter(
        (entry) =>
          entry.autoOpen === true &&
          entry.resource.projectId === resource.projectId &&
          resourceKey(entry.resource) !== resourceKey(resource) &&
          available(entry.resource),
      );
      const openings = preferences.openings(resource, defaults);
      if (!present) return;
      if (!openings.length) return;
      const resolved = await resolveRelatedOpenings({
        defaults,
        openings,
        service: options.createService(resource),
        signal: controller.signal,
        available,
        current,
      });
      if (!current()) return;
      openingPreviews = true;
      try {
        preferences.run(() => {
          for (const { entry, target } of resolved) {
            if (current() && available(entry.resource))
              opener.open(target, resource, entry, preferences.shouldReveal(resource, entry));
          }
        });
      } finally {
        openingPreviews = false;
      }
    } catch (error) {
      if (current()) console.warn("Could not open related resources", error);
    }
  };
  const open = (source: ResourceRef, present = true) => {
    const resource = canonicalize(source);
    const owner = resource && ctx.resources.getKind(resource.type, resource.extensionId);
    cancelOtherSelections(resourceKey(resource));
    if (!enabled() || !resource || !owner?.relatedOpenings || owner.extensionId !== resource.extensionId) {
      if (!enabled()) abortAll();
      return Promise.resolve();
    }
    const key = requestKey(resourceKey(resource));
    const existing = pending.get(key);
    if (existing?.owner === owner && !existing.controller.signal.aborted) {
      return existing.promise;
    }
    existing?.controller.abort();
    preferences.enter(resource);
    const completion = Promise.withResolvers<void>();
    const request: RelatedLookup = {
      resource,
      owner,
      controller: new AbortController(),
      removed: new Set(),
      promise: completion.promise,
    };
    pending.set(key, request);
    void load(request, present)
      .finally(() => {
        if (pending.get(key) === request) pending.delete(key);
      })
      .then(completion.resolve, completion.reject);
    return request.promise;
  };
  const primary = ctx.pageLocations.onDidNavigate((location) => {
    if (openingPreviews) return;
    if (location.resource) {
      const resource = location.resource;
      const key = relatedResourcePageKey(ctx);
      void Promise.resolve().then(() => {
        if (!disposed && relatedResourcePageKey(ctx) === key) void open(resource);
      });
    } else cancelOtherSelections();
  });
  const primaryState = ctx.pages.store.subscribe((state, previous) => {
    const key = relatedResourceStateKey(state);
    const previousKey = relatedResourceStateKey(previous);
    if (key === previousKey && state.activeModeId === previous.activeModeId) return;
    if (openingPreviews) return;
    const modeChanged = state.activeModeId !== previous.activeModeId || state.projectId !== previous.projectId;
    if (!modeChanged) preferences.run(() => opener.leavePage(previousKey));
    const resource = ctx.pages.store.getState().location?.resource;
    cancelOtherSelections(resourceKey(resource));
    // Evaluate after the new page layout settles, including saved-route boot.
    if (resource) {
      const restoresMode = state.layoutActivation === "restore-mode";
      void Promise.resolve().then(() => {
        if (!disposed && relatedResourcePageKey(ctx) === key) void open(resource, !restoresMode);
      });
    }
  });
  const navigation = ctx.navigation.onDidOpenTarget((target) => {
    if (openingPreviews) return;
    const resource = targetResource(target);
    const routed = ctx.pages.store.getState().location?.resource;
    if (resource && routed && resourceKey(canonicalize(resource)) === resourceKey(canonicalize(routed))) return;
    if (resource) void open(resource);
    else if (target.kind === "page" || target.kind === "panel" || target.kind === "compound") abortAll();
  });
  const project = ctx.pages.store.subscribeSelector((state) => state.projectId, abortAll);
  const owners = ctx.resources.store.subscribe(() => {
    for (const { owner, controller } of pending.values()) {
      if (ctx.resources.getKind(owner.kind, owner.extensionId) !== owner) controller.abort();
    }
  });
  const removal = ctx.resources.onWillRemove((resource) => {
    const key = resourceKey(resource);
    for (const request of pending.values()) {
      if (request.controller.signal.aborted) continue;
      // The owner may not have returned the target identity yet. Track removals
      // only for the pending request; later authoritative opens start fresh.
      request.removed.add(key);
      if (key === resourceKey(request.resource)) request.controller.abort();
    }
    return [];
  });
  const preference = ctx.preferences.onDidChangeValue((name) => {
    if (name === openRelatedResourcesPreference && !enabled()) abortAll();
  });
  const selection = ctx.layout.onDidActivatePanel((panel) => {
    if (openingPreviews) return;
    const routed = ctx.pages.store.getState().location?.resource;
    if (panel.resource && resourceKey(canonicalize(panel.resource)) === resourceKey(routed && canonicalize(routed)))
      return;
    if (panel.resource) void open(panel.resource);
    else cancelOtherSelections();
  });
  const selectionState = ctx.layout.store.subscribeSelector(
    () => {
      const resource = ctx.layout.getActivePanel()?.resource;
      return resource && resourceKey(resource);
    },
    (key) => {
      if (!openingPreviews) cancelOtherSelections(key);
    },
  );
  const scope = ctx.layout.onWillChangePersistenceScope(() => {
    abortAll();
  });
  return {
    open,
    dispose() {
      disposed = true;
      abortAll();
      primary.dispose();
      primaryState();
      navigation.dispose();
      project();
      owners();
      removal.dispose();
      preference.dispose();
      selection.dispose();
      selectionState();
      scope.dispose();
      preferences.dispose();
      opener.dispose();
      schema.dispose();
    },
  };
};
