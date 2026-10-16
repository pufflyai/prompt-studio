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
  let pending:
    | {
        key: string;
        owner: RegisteredResourceKind;
        controller: AbortController;
        promise: Promise<void>;
      }
    | undefined;
  let openingPreviews = false;
  const preferences = createRelatedResourcePreferences(ctx, canonicalize, () => pending?.controller.abort());
  const enabled = () => ctx.preferences.getValue(openRelatedResourcesPreference) !== false;
  const load = async (resource: ResourceRef, owner: RegisteredResourceKind, controller: AbortController) => {
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
      preferences.run(() => preferences.restoreVisibility(resource));
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
  const open = (source: ResourceRef) => {
    const resource = canonicalize(source);
    const owner = resource && ctx.resources.getKind(resource.type);
    if (!enabled() || !resource || !owner?.relatedOpenings || owner.extensionId !== resource.extensionId) {
      pending?.controller.abort();
      return Promise.resolve();
    }
    const key = resourceKey(resource);
    if (pending?.key === key && pending.owner === owner && !pending.controller.signal.aborted) return pending.promise;
    pending?.controller.abort();
    preferences.enter(resource);
    const controller = new AbortController();
    const promise = load(resource, owner, controller).finally(() => {
      if (pending?.controller === controller) pending = undefined;
    });
    pending = { key, owner, controller, promise };
    return promise;
  };
  const primary = ctx.pageLocations.onDidNavigate((location) => {
    if (openingPreviews) return;
    if (location.resource) {
      preferences.enter(location.resource);
      void open(location.resource);
    } else pending?.controller.abort();
  });
  const primaryState = ctx.pages.store.subscribeSelector(
    () => relatedResourcePageKey(ctx),
    (_key, previousKey) => {
      if (openingPreviews) return;
      preferences.run(() => opener.closePagePreviews(previousKey));
      const resource = ctx.pages.store.getState().location?.resource;
      if (resource) preferences.enter(resource);
      if (pending?.key !== resourceKey(ctx.pages.store.getState().location?.resource)) pending?.controller.abort();
    },
  );
  const navigation = ctx.navigation.onDidOpenTarget((target) => {
    if (openingPreviews) return;
    const resource = targetResource(target);
    if (resource) void open(resource);
    else if (target.kind === "page" || target.kind === "panel" || target.kind === "compound")
      pending?.controller.abort();
  });
  const project = ctx.pages.store.subscribeSelector(
    (state) => state.projectId,
    () => pending?.controller.abort(),
  );
  const owners = ctx.resources.store.subscribe(() => {
    if (pending && ctx.resources.getKind(pending.owner.kind) !== pending.owner) pending.controller.abort();
  });
  const preference = ctx.preferences.onDidChangeValue((name) => {
    if (name === openRelatedResourcesPreference && !enabled()) pending?.controller.abort();
  });
  const selection = ctx.layout.onDidActivatePanel((panel) => {
    if (openingPreviews) return;
    if (panel.resource) void open(panel.resource);
    else pending?.controller.abort();
  });
  const selectionState = ctx.layout.store.subscribeSelector(
    () => {
      const resource = ctx.layout.getActivePanel()?.resource;
      return resource && resourceKey(resource);
    },
    (key) => {
      if (!openingPreviews && pending?.key !== key) pending?.controller.abort();
    },
  );
  const restoration = ctx.layout.onWillRestoreLayout(() => pending?.controller.abort());
  const scope = ctx.layout.onWillChangePersistenceScope(() => {
    if (!openingPreviews) {
      // The registry has prepared the incoming page; clear the outgoing rendered
      // tabs too before the scope switch writes its saved layout.
      preferences.run(() => {
        for (const id of opener.closePagePreviews(relatedResourcePageKey(ctx))) ctx.layout.removeWidgetPlacement(id);
      });
    }
    pending?.controller.abort();
  });
  return {
    open,
    dispose() {
      pending?.controller.abort();
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
