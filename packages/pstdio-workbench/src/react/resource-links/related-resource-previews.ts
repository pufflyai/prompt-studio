import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { NavigationTarget, RegisteredResourceKind, WorkbenchModuleContext } from "../../core";
import { relatedResourcePageKey } from "./related-resource-page-key";
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
      request: { controller: AbortController; present: boolean };
      promise: Promise<void>;
    }
  >();
  const abortAll = () => {
    for (const { request } of pending.values()) request.controller.abort();
  };
  const cancelPresentation = () => {
    for (const { request } of pending.values()) request.present = false;
  };
  const cancelOtherSelections = (selectedKey?: string) => {
    const source = ctx.pages.store.getState().location?.resource;
    const pageResource = source && canonicalize(source);
    for (const [key, { request }] of pending) {
      if (key === selectedKey) continue;
      request.present = false;
      // A manual panel selection must not discard the routed page's declaration
      // lookup: its result still determines which user choices belong to the page.
      if (key !== resourceKey(pageResource)) request.controller.abort();
    }
  };
  let openingPreviews = false;
  let disposed = false;
  const preferences = createRelatedResourcePreferences(ctx, canonicalize, cancelPresentation);
  const enabled = () => ctx.preferences.getValue(openRelatedResourcesPreference) !== false;
  const load = async (
    resource: ResourceRef,
    owner: RegisteredResourceKind,
    request: { controller: AbortController; present: boolean },
  ) => {
    const { controller } = request;
    const current = () => !controller.signal.aborted && enabled() && ctx.resources.getKind(resource.type) === owner;
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
      if (!request.present) return;
      preferences.run(() => preferences.restoreVisibility(resource));
      if (!openings.length) return;
      const resolved = await options.createService(resource).resolve(
        openings.map((entry) => entry.resource),
        controller.signal,
      );
      if (!current() || !request.present) return;
      const targets = new Map(resolved.map((entry) => [resourceKey(entry.resource), entry.target]));
      openingPreviews = true;
      try {
        preferences.run(() => {
          for (const entry of openings) {
            const target = targets.get(resourceKey(entry.resource));
            if (target && preferences.allows(resource, entry)) opener.open(target, resource, entry);
          }
          preferences.select(resource);
        });
      } finally {
        openingPreviews = false;
      }
    } catch (error) {
      if (current()) console.warn("Could not open related resources", error);
    }
  };
  const evaluate = (source: ResourceRef, present: boolean) => {
    const resource = canonicalize(source);
    const owner = resource && ctx.resources.getKind(resource.type);
    cancelOtherSelections(resourceKey(resource));
    if (!enabled() || !resource || !owner?.relatedOpenings || owner.extensionId !== resource.extensionId) {
      if (!enabled()) abortAll();
      return Promise.resolve();
    }
    const key = resourceKey(resource);
    const existing = pending.get(key);
    if (existing?.owner === owner && !existing.request.controller.signal.aborted) {
      existing.request.present ||= present;
      return existing.promise;
    }
    existing?.request.controller.abort();
    preferences.enter(resource);
    const request = { controller: new AbortController(), present };
    const promise = load(resource, owner, request).finally(() => {
      if (pending.get(key)?.request === request) pending.delete(key);
    });
    pending.set(key, { owner, request, promise });
    return promise;
  };
  const open = (source: ResourceRef) => evaluate(source, true);
  const primary = ctx.pageLocations.onDidNavigate((location) => {
    if (openingPreviews) return;
    if (location.resource) {
      preferences.enter(location.resource);
      void open(location.resource);
    } else cancelOtherSelections();
  });
  const primaryState = ctx.pages.store.subscribeSelector(
    () => relatedResourcePageKey(ctx),
    (key, previousKey) => {
      if (openingPreviews) return;
      preferences.run(() => opener.closePagePreviews(previousKey));
      const resource = ctx.pages.store.getState().location?.resource;
      cancelOtherSelections(resourceKey(resource));
      // Saved-route boot restores its layout without replaying automatic opens.
      // Read the owner only to classify subsequent user edits to related trays.
      if (resource) {
        preferences.enter(resource);
        void Promise.resolve().then(() => {
          if (!disposed && relatedResourcePageKey(ctx) === key) void evaluate(resource, false);
        });
      }
    },
  );
  const navigation = ctx.navigation.onDidOpenTarget((target) => {
    if (openingPreviews) return;
    const resource = targetResource(target);
    if (resource) void open(resource);
    else if (target.kind === "page" || target.kind === "panel" || target.kind === "compound") abortAll();
  });
  const project = ctx.pages.store.subscribeSelector((state) => state.projectId, abortAll);
  const owners = ctx.resources.store.subscribe(() => {
    for (const { owner, request } of pending.values()) {
      if (ctx.resources.getKind(owner.kind) !== owner) request.controller.abort();
    }
  });
  const preference = ctx.preferences.onDidChangeValue((name) => {
    if (name === openRelatedResourcesPreference && !enabled()) abortAll();
  });
  const selection = ctx.layout.onDidActivatePanel((panel) => {
    if (openingPreviews) return;
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
  const restoration = ctx.layout.onWillRestoreLayout(cancelPresentation);
  const scope = ctx.layout.onWillChangePersistenceScope(() => {
    if (!openingPreviews) {
      // The registry has prepared the incoming page; clear the outgoing rendered
      // tabs too before the scope switch writes its saved layout.
      preferences.run(() => {
        for (const id of opener.closePagePreviews(relatedResourcePageKey(ctx))) ctx.layout.removeWidgetPlacement(id);
      });
    }
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
      restoration.dispose();
      scope.dispose();
      preferences.dispose();
      opener.dispose();
      schema.dispose();
    },
  };
};
