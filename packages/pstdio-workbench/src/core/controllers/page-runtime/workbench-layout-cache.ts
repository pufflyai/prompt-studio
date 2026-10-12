import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { LayoutPersistenceAdapter } from "../../registries/layout/layout-model-types";
import {
  mergeWithDefaultRegions,
  type WorkbenchLayout,
  type WorkbenchWidgetPlacement,
  workbenchRegions,
} from "../../registries/layout/layout-types";
import { restorePageGeometry } from "../../registries/layout/owner-region-state";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { createWorkbenchInput } from "../../workbench-core-types";
import { modeLayoutScope, pageGeometryScope, pageOwnerFromLayoutScope } from "./owner-layout-scope";
import { retireSingleResourceAliases } from "./owner-layout-widgets";

const selectPlacements = (layout: WorkbenchLayout, include: (placement: WorkbenchWidgetPlacement) => boolean) => {
  const regions = { ...layout.regions };
  for (const id of workbenchRegions) {
    const region = layout.regions[id];
    const widgets = region.widgets.filter(include);
    regions[id] = {
      ...region,
      widgets,
      activeWidgetId: widgets.some((widget) => widget.widgetId === region.activeWidgetId)
        ? region.activeWidgetId
        : undefined,
    };
  }
  return { ...layout, regions };
};
/** Page caches hold page and shell placements. Shared mode choices have one project/mode owner. */
export const createWorkbenchLayoutCache = (input: createWorkbenchInput) => {
  // The persistence adapter does not enumerate keys. Track only scopes visited
  // by this workbench so live removal can edit their existing cached layouts.
  const scopes = new Set<string | undefined>();
  const memory = new Map<string | undefined, WorkbenchLayout>();
  const adapter: LayoutPersistenceAdapter | undefined = input.persistence
    ? {
        getLayout: (scope) => input.persistence?.getSnapshot(scope)?.layout,
        setLayout: (layout, scope) => input.persistence?.setSnapshot({ layout }, scope),
        flush: input.persistence.flush,
        dispose: input.persistence.dispose,
      }
    : input.layoutPersistence;
  const read = (scope?: string) => {
    scopes.add(scope);
    const snapshot = adapter
      ? runWorkbenchEffect(`layout cache read for ${scope ?? "unscoped"}`, () => adapter.getLayout(scope))
      : memory.get(scope);
    return snapshot ? mergeWithDefaultRegions(snapshot, input.defaultPanelOpenByRegionId) : undefined;
  };
  const persist = (layout: WorkbenchLayout, scope?: string) => {
    scopes.add(scope);
    if (!adapter) memory.set(scope, layout);
    return runWorkbenchEffect(`layout cache write for ${scope ?? "unscoped"}`, () => adapter?.setLayout(layout, scope));
  };
  const write = (layout: WorkbenchLayout, scope?: string) => {
    const ownedWidgetIds = new Set(
      Object.values(layout.regions).flatMap((region) => region.widgets.map((p) => p.widgetId)),
    );
    for (const previousScope of scopes) {
      if (previousScope === scope) continue;
      const previous = read(previousScope);
      if (!previous) continue;
      const next = retireSingleResourceAliases(previous, ownedWidgetIds);
      if (next !== previous) persist(next, previousScope);
    }
    return persist(layout, scope);
  };
  return {
    removeResource(resource: ResourceRef) {
      for (const scope of scopes) {
        const layout = read(scope);
        if (layout)
          write(
            selectPlacements(layout, (placement) => resourceKey(placement.resource) !== resourceKey(resource)),
            scope,
          );
      }
    },
    layout: {
      ...adapter,
      getLayout: (scope?: string) => {
        const layout = read(scope);
        const owner = pageOwnerFromLayoutScope(scope);
        if (!layout || !owner) return layout;
        const geometry = read(pageGeometryScope(owner.projectId, owner.pageId));
        return restorePageGeometry(layout, geometry);
      },
      setLayout: (layout: WorkbenchLayout, scope?: string) => {
        const snapshot = selectPlacements(layout, (p) => p.placementIdentity?.kind !== "mode");
        for (const id of workbenchRegions) {
          snapshot.regions[id].savedWidgetOrder = layout.regions[id].widgets.map((widget) => widget.widgetId);
        }
        const owner = pageOwnerFromLayoutScope(scope);
        if (owner)
          write(
            selectPlacements(snapshot, () => false),
            pageGeometryScope(owner.projectId, owner.pageId),
          );
        return write(snapshot, scope);
      },
    },
    readMode: (projectId: string | undefined, modeId: string) => read(modeLayoutScope(projectId, modeId)),
    readPageGeometry: (projectId: string, pageId: string) => read(pageGeometryScope(projectId, pageId)),
    saveMode: (projectId: string | undefined, modeId: string, layout: WorkbenchLayout) =>
      write(
        selectPlacements(layout, (p) => p.placementIdentity?.kind === "mode" && p.placementIdentity.modeId === modeId),
        modeLayoutScope(projectId, modeId),
      ),
  };
};
