import type { NavigationTargetPage, ResourceRef } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import { buildUpdatedPlacement } from "../../registries/layout/layout-operations";
import type { OpenWidgetInput, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";
import { pageLocationTarget } from "../page-location/page-location-target";
import { modeLayoutScope } from "./owner-layout-scope";
import type { createWorkbenchLayoutCache } from "./workbench-layout-cache";

type LayoutCache = ReturnType<typeof createWorkbenchLayoutCache>;
const caches = new WeakMap<WorkbenchCore, LayoutCache>();

export const updateSavedTransferredEditor = (
  core: WorkbenchCore,
  tab: WorkbenchWidgetPlacement,
  changes: OpenWidgetInput & Pick<WorkbenchWidgetPlacement, "section" | "position">,
) => {
  if (!tab.declarationIdentity) return;
  caches.get(core)?.updateTransferredPlacement(tab.declarationIdentity, (placement) =>
    placement.widgetId === tab.widgetId
      ? {
          ...buildUpdatedPlacement(placement, core.layout.getWidget(placement.contributionId)!, changes),
          ...(changes.section !== undefined || changes.position !== undefined
            ? { section: changes.section, position: changes.position }
            : {}),
        }
      : placement,
  );
};

export const saveOpenOwnerLayouts = (core: WorkbenchCore) => {
  const state = core.pages.store.getState();
  if (state.activeModeId) caches.get(core)?.saveMode(state.projectId, state.activeModeId, core.layout.getLayout());
};

export const connectOpenOwnerLayouts = (core: WorkbenchCore, cache: LayoutCache) => {
  caches.set(core, cache);
  core.layout.store.subscribe(() => {
    const state = core.pages.store.getState();
    if (state.activeModeId) cache.saveMode(state.projectId, state.activeModeId, core.layout.getLayout());
  });
};

export const openOwnerLayouts = (core: WorkbenchCore) => {
  const state = core.pages.store.getState();
  const scope = core.layout.getPersistenceScope();
  const current = { scope, layout: core.layout.getLayout() };
  const layouts = state.projectId ? (caches.get(core)?.listLayouts(state.projectId) ?? []) : [];
  const modeScope = state.activeModeId ? modeLayoutScope(state.projectId, state.activeModeId) : undefined;
  return [current, ...layouts.filter((entry) => entry.scope !== scope && entry.scope !== modeScope)];
};

export const pageOwnerLocation = (core: WorkbenchCore, scope: string) => {
  const match = scope.match(/\/owner\/page\/([^/]+)\/(unbound|resource\/(.+))$/);
  if (!match) return undefined;
  const page = core.pages.getPage(decodeURIComponent(match[1]!));
  if (!page) return undefined;
  const key = match[3] ? decodeURIComponent(match[3]) : undefined;
  const [extensionId, projectId, type, id] = key ? JSON.parse(key) : [];
  const identity: ResourceRef | undefined = key
    ? { type, id, ...(extensionId ? { extensionId } : {}), ...(projectId ? { projectId } : {}) }
    : undefined;
  const layout = openOwnerLayouts(core).find((entry) => entry.scope === scope)?.layout;
  const selected = layout?.regions.main.widgets.find((tab) => tab.widgetId === layout.regions.main.activeWidgetId);
  const resource =
    Object.values(layout?.regions ?? {})
      .flatMap((region) => region.widgets)
      .find((tab) => key && resourceKey(tab.resource) === key)?.resource ??
    identity ??
    (page.resource ? selected?.resource : undefined);
  const context = selected?.pageContext;
  return {
    kind: "page" as const,
    page: page.ref,
    ...(resource ? { resource } : {}),
    mode: context?.mode,
    ...(context?.parent ? { parent: pageLocationTarget(context.parent) } : {}),
  } satisfies NavigationTargetPage;
};
