import { useState } from "react";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { openOwnerLayouts } from "../../core/controllers/page-runtime/open-owner-layouts";
import { projectResourceKey } from "../../core/registries/resources/project-resource-identity";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { retainViewPlacements } from "./retained-view-placements";

// A region owns live views; the active location owns only their visibility.
// Keep this cache in React so it is discarded with the workbench, never persisted.
export const useRetainedViewPlacements = (workbench: WorkbenchCore, current: WorkbenchWidgetPlacement[]) => {
  const views = useWorkbenchStore(workbench.views.store, (state) => state.views);
  const removedKeys = useWorkbenchStore(workbench.resources.store, (state) => state.removedResourceKeys);
  const pages = useWorkbenchStore(workbench.pages.store, (state) => state.pages);
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const widgets = useWorkbenchStore(workbench.layout.store, (state) => state.widgets);
  const membership = useWorkbenchStore(workbench.layout.store, (state) =>
    Object.values(state.layout.regions)
      .flatMap((region) => region.widgets.map((placement) => placement.widgetId))
      .join("\0"),
  );
  const live = new Set(membership.split("\0"));
  let saved: ReadonlySet<string> | undefined;
  const [previous, setPrevious] = useState(current);
  const placements = retainViewPlacements(previous, current, new Set(Object.keys(views)), (placement) => {
    if (placement.resource && removedKeys.has(projectResourceKey(placement.resource, projectId)!)) return false;
    const identity = placement.placementIdentity;
    if (!identity || !projectId) return true;
    if (!widgets[placement.contributionId]) return false;
    if (identity.kind === "page" && !pages[identity.pageId]) return false;
    if (live.has(placement.widgetId)) return true;
    // Only a hidden owned view needs saved-owner lookup. Chrome and live tabs never read those snapshots.
    saved ??= new Set(
      openOwnerLayouts(workbench).flatMap(({ layout }) =>
        Object.values(layout.regions).flatMap((region) => region.widgets.map((placement) => placement.widgetId)),
      ),
    );
    return saved.has(placement.widgetId);
  });
  if (previous !== placements) setPrevious(placements);
  return placements;
};
