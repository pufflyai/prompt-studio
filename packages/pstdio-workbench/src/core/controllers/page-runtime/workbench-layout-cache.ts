import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { LayoutPersistenceAdapter } from "../../registries/layout/layout-model-types";
import {
  createDefaultWorkbenchLayout,
  type WorkbenchLayout,
  type WorkbenchWidgetPlacement,
  workbenchRegions,
} from "../../registries/layout/layout-types";
import { getWorkbenchModePanelForRegion } from "../../registries/modes/mode-layout";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { createWorkbenchInput, WorkbenchPagePersistenceScopeInput } from "../../workbench-core-types";
import { loadWorkbenchLocationLayout } from "./page-state-restoration";

const selectPlacements = (
  layout: WorkbenchLayout,
  include: (placement: WorkbenchWidgetPlacement, region: (typeof workbenchRegions)[number]) => boolean,
) => {
  const regions = { ...layout.regions };
  for (const id of workbenchRegions) {
    const region = layout.regions[id];
    const widgets = region.widgets.filter((widget) => include(widget, id));
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
const modeScope = (projectId: string | undefined, modeId: string) =>
  `workbench-mode:${JSON.stringify([projectId ?? null, modeId])}`;
const mainScope = (context: WorkbenchPagePersistenceScopeInput) =>
  `workbench-main:${JSON.stringify([context.projectId, context.modeId, context.pageId, resourceKey(context.resource)])}`;

const isModePlacement = (placement: WorkbenchWidgetPlacement, region: (typeof workbenchRegions)[number]) =>
  region !== "main" &&
  (placement.placementIdentity?.kind === "mode" ||
    (placement.placementIdentity?.kind !== "page" && Boolean(getWorkbenchModePanelForRegion(region))));

/** Shared panel choices belong to one project/mode. Page caches hold the page's own slots. */
export const createWorkbenchLayoutCache = (
  input: createWorkbenchInput,
  getActiveMode: () => string | undefined = () => undefined,
) => {
  // The persistence adapter does not enumerate keys. Track only scopes visited
  // by this workbench so live removal can edit their existing cached layouts.
  const scopes = new Set<string | undefined>();
  const memory = new Map<string | undefined, WorkbenchLayout>();
  const adapter: LayoutPersistenceAdapter = input.persistence
    ? {
        getLayout: (scope) => input.persistence?.getSnapshot(scope)?.layout,
        setLayout: (layout, scope) => input.persistence?.setSnapshot({ layout }, scope),
        flush: input.persistence.flush,
        dispose: input.persistence.dispose,
      }
    : (input.layoutPersistence ?? {
        getLayout: (scope) => memory.get(scope),
        setLayout: (layout, scope) => memory.set(scope, layout),
      });
  const read = (scope?: string) => {
    scopes.add(scope);
    return runWorkbenchEffect(`layout cache read for ${scope ?? "unscoped"}`, () => adapter.getLayout(scope));
  };
  const write = (layout: WorkbenchLayout, scope?: string) => {
    scopes.add(scope);
    return runWorkbenchEffect(`layout cache write for ${scope ?? "unscoped"}`, () => adapter.setLayout(layout, scope));
  };
  return {
    loadPageLayout(context: WorkbenchPagePersistenceScopeInput) {
      const layout = loadWorkbenchLocationLayout(
        { ...input, persistence: undefined, layoutPersistence: { ...adapter, getLayout: read } },
        context,
      );
      if (!context.pageId || !context.modeId) return layout;
      const main = read(mainScope(context));
      if (!layout && !main) return undefined;
      const base = layout ?? createDefaultWorkbenchLayout();
      const mainIds = new Set(main?.regions.main.widgets.map((tab) => tab.widgetId));
      return {
        ...base,
        regions: {
          ...base.regions,
          main: main?.regions.main ?? { ...base.regions.main, widgets: [], activeWidgetId: undefined },
        },
        activeWidgetId: mainIds.has(main?.activeWidgetId ?? "") ? main?.activeWidgetId : base.activeWidgetId,
        activeLocationWidgetId: mainIds.has(main?.activeLocationWidgetId ?? "")
          ? main?.activeLocationWidgetId
          : base.activeLocationWidgetId,
      };
    },
    savePageMain(context: WorkbenchPagePersistenceScopeInput, layout: WorkbenchLayout) {
      if (context.pageId && context.modeId)
        write(
          selectPlacements(layout, (_widget, region) => region === "main"),
          mainScope(context),
        );
    },
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
      getLayout: read,
      setLayout: (layout: WorkbenchLayout, scope?: string) => {
        const snapshot = selectPlacements(
          layout,
          (p, region) => !getActiveMode() || (region !== "main" && !isModePlacement(p, region)),
        );
        for (const id of workbenchRegions) {
          snapshot.regions[id].savedWidgetOrder = layout.regions[id].widgets.map((widget) => widget.widgetId);
        }
        return write(snapshot, scope);
      },
    },
    readMode: (projectId: string | undefined, modeId: string) => read(modeScope(projectId, modeId)),
    saveMode: (projectId: string | undefined, modeId: string, layout: WorkbenchLayout) =>
      write(
        selectPlacements(
          layout,
          (p, region) =>
            isModePlacement(p, region) &&
            (p.placementIdentity?.kind !== "mode" || p.placementIdentity.modeId === modeId),
        ),
        modeScope(projectId, modeId),
      ),
  };
};
