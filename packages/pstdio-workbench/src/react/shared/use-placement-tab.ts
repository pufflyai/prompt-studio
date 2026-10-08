import { useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchTabSnapshot, WorkbenchWidgetPlacement } from "../../core";
import { toPanelInstance } from "../../core/registries/layout/panel-api";
import { useWorkbenchStore } from "./use-workbench-store";

const readPlacementTab = (placement: WorkbenchWidgetPlacement | undefined) =>
  placement?.tab?.getSnapshot(toPanelInstance(placement)) ?? {};

export const usePlacementTab = (placement: WorkbenchWidgetPlacement | undefined, workbench: WorkbenchCore) => {
  useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  const [state, setState] = useState<{ placement: typeof placement; snapshot: WorkbenchTabSnapshot }>(() => ({
    placement,
    snapshot: readPlacementTab(placement),
  }));
  useEffect(() => {
    const refresh = () => setState({ placement, snapshot: readPlacementTab(placement) });
    const subscription = placement?.tab?.subscribe?.(refresh);
    refresh();
    return () => {
      if (typeof subscription === "function") subscription();
      else subscription?.dispose();
    };
  }, [placement]);
  const snapshot = state.placement === placement ? state.snapshot : readPlacementTab(placement);
  const resource = placement?.resource;
  const projected = resource ? workbench.resources.preview.resolve(resource) : undefined;
  const changed = projected && projected !== resource;
  return changed ? { ...snapshot, label: projected.label } : snapshot;
};
