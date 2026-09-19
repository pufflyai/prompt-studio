import { useState } from "react";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { retainViewPlacements } from "./retained-view-placements";

// A region owns live views; the active location owns only their visibility.
// Keep this cache in React so it is discarded with the workbench, never persisted.
export const useRetainedViewPlacements = (workbench: WorkbenchCore, current: WorkbenchWidgetPlacement[]) => {
  const views = useWorkbenchStore(workbench.views.store, (state) => state.views);
  const [previous, setPrevious] = useState(current);
  const placements = retainViewPlacements(previous, current, new Set(Object.keys(views)));
  if (previous !== placements) setPrevious(placements);
  return placements;
};
