import { useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { type RetainedViewState, retainRecentViewPlacements } from "./retained-view-lifetime";

// A region owns live views; the active location owns only their visibility.
// Keep this cache in React so it is discarded with the workbench, never persisted.
export const useRetainedViewPlacements = (
  workbench: WorkbenchCore,
  current: WorkbenchWidgetPlacement[],
  open?: ReadonlySet<string>,
) => {
  const views = useWorkbenchStore(workbench.views.store, (state) => state.views);
  const [previous, setPrevious] = useState<RetainedViewState>(() => ({ placements: current, expires: new Map() }));
  const next = retainRecentViewPlacements(previous, current, new Set(Object.keys(views)), open, Date.now());
  if (previous !== next) setPrevious(next);
  const deadline = Math.min(...next.expires.values());
  useEffect(() => {
    if (!Number.isFinite(deadline)) return;
    const timer = setTimeout(() => setPrevious((state) => ({ ...state })), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [deadline]);
  return next.placements;
};
