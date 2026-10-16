import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { NavigationTarget, WorkbenchModuleContext } from "../../core";
import type { WorkbenchResourceLinksOptions } from "./resource-links-module";
import type { ResourceLinkCandidate } from "./resource-links-types";
import { createResourcePreviewOpener } from "./resource-preview-opener";

export const openRelatedResourcesPreference = "workbench.openRelatedResources";
const targetResource = (target: NavigationTarget): ResourceRef | undefined => {
  if (target.kind === "compound") return target.targets.map(targetResource).find(Boolean);
  return target.kind === "page" || target.kind === "panel" ? target.resource : undefined;
};
const linkedCandidates = async (options: WorkbenchResourceLinksOptions, resource: ResourceRef, signal: AbortSignal) => {
  const service = options.createService(resource);
  const key = resourceKey(resource);
  const linked = new Map<string, ResourceRef>();
  let cursor: string | undefined;
  do {
    const page = await service.list({ resource, direction: "both", limit: 100, cursor });
    signal.throwIfAborted();
    for (const edge of page.items) {
      const ref = resourceKey(edge.source) === key ? edge.target : edge.source;
      if (resourceKey(ref) !== key) linked.set(resourceKey(ref), ref);
    }
    cursor = page.nextCursor;
  } while (cursor);
  return service.resolve([...linked.values()], signal);
};
const openCandidates = (
  ctx: WorkbenchModuleContext,
  source: ResourceRef,
  candidates: readonly ResourceLinkCandidate[],
  opener: ReturnType<typeof createResourcePreviewOpener>,
) => {
  const active = ctx.layout.getLayout().activeWidgetId;
  const selectedKinds = new Set<string>();
  for (const candidate of candidates) {
    const kind = JSON.stringify([candidate.resource.extensionId, candidate.resource.type]);
    if (!candidate.target || selectedKinds.has(kind) || resourceKey(candidate.resource) === resourceKey(source))
      continue;
    if (opener.open(candidate.target)) selectedKinds.add(kind);
  }
  if (active && ctx.layout.listPanelInstances().some((panel) => panel.instanceId === active))
    ctx.layout.activatePanel(active);
};

export const registerRelatedResourcePreviews = (
  ctx: WorkbenchModuleContext,
  options: WorkbenchResourceLinksOptions,
) => {
  const schema = ctx.preferences.registerSchema({
    properties: { [openRelatedResourcesPreference]: { type: "boolean", scope: "user", default: true } },
  });
  const opener = createResourcePreviewOpener(ctx);
  let pending: { key: string; controller: AbortController; promise: Promise<void> } | undefined;
  let openingPreviews = false;
  const enabled = () => ctx.preferences.getValue(openRelatedResourcesPreference) !== false;
  const load = async (resource: ResourceRef, controller: AbortController) => {
    const candidates = [...ctx.resources.listRelatedResources(resource)];
    try {
      candidates.push(...(await linkedCandidates(options, resource, controller.signal)));
    } catch {
      /* Unavailable owners must not block native related resources. */
    }
    if (!controller.signal.aborted && enabled()) {
      openingPreviews = true;
      try {
        openCandidates(ctx, resource, candidates, opener);
      } finally {
        openingPreviews = false;
      }
    }
  };
  const open = (source: ResourceRef) => {
    const resource = options.canonicalize(source) ?? (source.projectId && source.extensionId ? source : undefined);
    if (!enabled() || !resource) {
      pending?.controller.abort();
      return Promise.resolve();
    }
    const key = resourceKey(resource);
    if (pending?.key === key && !pending.controller.signal.aborted) return pending.promise;
    pending?.controller.abort();
    const controller = new AbortController();
    const promise = load(resource, controller).finally(() => {
      if (pending?.controller === controller) pending = undefined;
    });
    pending = { key, controller, promise };
    return promise;
  };
  const primary = ctx.pages.store.subscribeSelector(
    (state) => state.location?.resource && resourceKey(state.location.resource),
    () => {
      const resource = ctx.getPrimaryResource();
      if (resource) void open(resource);
      else pending?.controller.abort();
    },
  );
  const navigation = ctx.navigation.onDidOpenTarget((target) => {
    const resource = targetResource(target);
    if (resource) void open(resource);
    else if (target.kind === "page" || target.kind === "panel" || target.kind === "compound")
      pending?.controller.abort();
  });
  const project = ctx.pages.store.subscribeSelector(
    (state) => state.projectId,
    () => pending?.controller.abort(),
  );
  const preference = ctx.preferences.onDidChangeValue((name) => {
    if (name === openRelatedResourcesPreference && !enabled()) pending?.controller.abort();
  });
  const selection = ctx.layout.store.subscribeSelector(
    () => ctx.layout.getActivePanel()?.resource,
    (resource) => {
      if (openingPreviews) return;
      if (resource) void open(resource);
      else pending?.controller.abort();
    },
    { equalityFn: (a, b) => a === b || Boolean(a && b && resourceKey(a) === resourceKey(b)) },
  );
  return {
    open,
    dispose() {
      pending?.controller.abort();
      primary();
      navigation.dispose();
      project();
      preference.dispose();
      selection();
      opener.dispose();
      schema.dispose();
    },
  };
};
