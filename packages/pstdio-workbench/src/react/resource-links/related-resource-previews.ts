import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { NavigationTarget, RegisteredResourceKind, WorkbenchModuleContext } from "../../core";
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
  let pending:
    | {
        key: string;
        owner: RegisteredResourceKind;
        controller: AbortController;
        promise: Promise<void>;
      }
    | undefined;
  let openingPreviews = false;
  const enabled = () => ctx.preferences.getValue(openRelatedResourcesPreference) !== false;
  const load = async (resource: ResourceRef, owner: RegisteredResourceKind, controller: AbortController) => {
    const current = () => !controller.signal.aborted && enabled() && ctx.resources.getKind(resource.type) === owner;
    try {
      const entries = await owner.relatedOpenings!(resource, controller.signal);
      if (!current()) return;
      const openings = entries.filter(
        (entry) =>
          entry.autoOpen === true &&
          entry.resource.projectId === resource.projectId &&
          resourceKey(entry.resource) !== resourceKey(resource),
      );
      if (!openings.length) return;
      const resolved = await options.createService(resource).resolve(
        openings.map((entry) => entry.resource),
        controller.signal,
      );
      if (!current()) return;
      const targets = new Map(resolved.map((entry) => [resourceKey(entry.resource), entry.target]));
      const active = ctx.layout.getLayout().activeWidgetId;
      openingPreviews = true;
      try {
        for (const entry of openings) {
          const target = targets.get(resourceKey(entry.resource));
          if (target) opener.open(target, resource, entry);
        }
      } finally {
        if (active && ctx.layout.listPanelInstances().some((panel) => panel.instanceId === active))
          ctx.layout.activatePanel(active);
        openingPreviews = false;
      }
    } catch (error) {
      if (current()) console.warn("Could not open related resources", error);
    }
  };
  const open = (source: ResourceRef) => {
    const resource = options.canonicalize(source) ?? (source.projectId && source.extensionId ? source : undefined);
    const owner = resource && ctx.resources.getKind(resource.type);
    if (!enabled() || !resource || !owner?.relatedOpenings || owner.extensionId !== resource.extensionId) {
      pending?.controller.abort();
      return Promise.resolve();
    }
    const key = resourceKey(resource);
    if (pending?.key === key && pending.owner === owner && !pending.controller.signal.aborted) return pending.promise;
    pending?.controller.abort();
    const controller = new AbortController();
    const promise = load(resource, owner, controller).finally(() => {
      if (pending?.controller === controller) pending = undefined;
    });
    pending = { key, owner, controller, promise };
    return promise;
  };
  const primary = ctx.pageLocations.onDidNavigate((location) => {
    if (openingPreviews) return;
    if (location.resource) void open(location.resource);
    else pending?.controller.abort();
  });
  const primaryState = ctx.pages.store.subscribeSelector(
    (state) => state.location?.resource && resourceKey(state.location.resource),
    (key) => {
      if (!openingPreviews && pending?.key !== key) pending?.controller.abort();
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
      opener.dispose();
      schema.dispose();
    },
  };
};
