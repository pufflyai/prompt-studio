import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { NavigationTarget, RegisteredResourceKind, WorkbenchModuleContext } from "../../core";
import { relatedResourcePageKey, relatedResourceStateKey } from "./related-resource-page-key";
import { createRelatedResourcePreferences } from "./related-resource-preferences";
import type { WorkbenchResourceLinksOptions } from "./resource-links-module";
import { createResourcePreviewOpener } from "./resource-preview-opener";

export const openRelatedResourcesPreference = "workbench.openRelatedResources";
const targetResource = (target: NavigationTarget): ResourceRef | undefined => {
  if (target.kind === "compound") return target.targets.map(targetResource).find(Boolean);
  return target.kind === "page" || target.kind === "panel" ? target.resource : undefined;
};

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
  const pending = new Map<
    string,
    {
      owner: RegisteredResourceKind;
      controller: AbortController;
      promise: Promise<void>;
    }
  >();
  const abortAll = () => {
    for (const { controller } of pending.values()) controller.abort();
  };
  const cancelOtherSelections = (selectedKey?: string) => {
    const source = ctx.pages.store.getState().location?.resource;
    const pageResource = source && canonicalize(source);
    for (const [key, { controller }] of pending) {
      if (key === selectedKey) continue;
      // A manual panel selection must not discard the routed page's declaration
      // lookup: its result still determines which user choices belong to the page.
      if (key !== resourceKey(pageResource)) controller.abort();
    }
  };
  let openingPreviews = false;
  let disposed = false;
  const preferences = createRelatedResourcePreferences(ctx, canonicalize);
  const enabled = () => ctx.preferences.getValue(openRelatedResourcesPreference) !== false;
  const load = async (
    resource: ResourceRef,
    owner: RegisteredResourceKind,
    controller: AbortController,
    present: boolean,
  ) => {
    const current = () =>
      !controller.signal.aborted && enabled() && ctx.resources.getKind(resource.type, resource.extensionId) === owner;
    try {
      const entries = await owner.relatedOpenings!(resource, controller.signal);
      if (!current()) return;
      const openings = preferences.openings(
        resource,
        entries.filter(
          (entry) =>
            entry.autoOpen === true &&
            entry.resource.projectId === resource.projectId &&
            resourceKey(entry.resource) !== resourceKey(resource),
        ),
      );
      if (!present) return;
      if (!openings.length) return;
      const resolved = await options.createService(resource).resolve(
        openings.map((entry) => entry.resource),
        controller.signal,
      );
      if (!current()) return;
      const targets = new Map(resolved.map((entry) => [resourceKey(entry.resource), entry.target]));
      openingPreviews = true;
      try {
        preferences.run(() => {
          for (const entry of openings) {
            const target = targets.get(resourceKey(entry.resource));
            if (target) opener.open(target, resource, entry, preferences.shouldReveal(resource, entry));
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
    const key = resourceKey(resource);
    const existing = pending.get(key);
    if (existing?.owner === owner && !existing.controller.signal.aborted) {
      return existing.promise;
    }
    existing?.controller.abort();
    preferences.enter(resource);
    const controller = new AbortController();
    const promise = load(resource, owner, controller, present).finally(() => {
      if (pending.get(key)?.controller === controller) pending.delete(key);
    });
    pending.set(key, { owner, controller, promise });
    return promise;
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
