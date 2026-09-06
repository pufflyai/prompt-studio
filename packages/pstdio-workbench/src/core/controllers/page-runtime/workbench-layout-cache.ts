import type { LayoutPersistenceAdapter } from "../../registries/layout/layout-model-types";
import {
  type WorkbenchLayout,
  type WorkbenchWidgetPlacement,
  workbenchRegions,
} from "../../registries/layout/layout-types";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { createWorkbenchInput } from "../../workbench-core-types";

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
const modeScope = (projectId: string | undefined, modeId: string) =>
  `workbench-mode:${JSON.stringify([projectId ?? null, modeId])}`;

/** Page caches hold page and shell placements. Shared mode choices have one project/mode owner. */
export const createWorkbenchLayoutCache = (input: createWorkbenchInput) => {
  const adapter: LayoutPersistenceAdapter | undefined = input.persistence
    ? {
        getLayout: (scope) => input.persistence?.getSnapshot(scope)?.layout,
        setLayout: (layout, scope) => input.persistence?.setSnapshot({ layout }, scope),
        flush: input.persistence.flush,
        dispose: input.persistence.dispose,
      }
    : input.layoutPersistence;
  const read = (scope?: string) =>
    runWorkbenchEffect(`layout cache read for ${scope ?? "unscoped"}`, () => adapter?.getLayout(scope));
  const write = (layout: WorkbenchLayout, scope?: string) =>
    runWorkbenchEffect(`layout cache write for ${scope ?? "unscoped"}`, () => adapter?.setLayout(layout, scope));
  return {
    layout: adapter
      ? {
          ...adapter,
          getLayout: read,
          setLayout: (layout: WorkbenchLayout, scope?: string) =>
            write(
              selectPlacements(layout, (p) => p.placementIdentity?.kind !== "mode"),
              scope,
            ),
        }
      : undefined,
    readMode: (projectId: string | undefined, modeId: string) => read(modeScope(projectId, modeId)),
    saveMode: (projectId: string | undefined, modeId: string, layout: WorkbenchLayout) =>
      write(
        selectPlacements(layout, (p) => p.placementIdentity?.kind === "mode" && p.placementIdentity.modeId === modeId),
        modeScope(projectId, modeId),
      ),
  };
};
