import { useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchPanelInstance, WorkbenchTabSnapshot, WorkbenchWidgetPlacement } from "../../core";
import { toPanelInstance } from "../../core/registries/layout/panel-api";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { useWorkbenchStore } from "./use-workbench-store";

type Placement = WorkbenchWidgetPlacement | WorkbenchPanelInstance;
const readPlacementTab = (placement: Placement | undefined) =>
  placement?.tab?.getSnapshot("instanceId" in placement ? placement : toPanelInstance(placement)) ?? {};

export const usePlacementTab = (placement: Placement | undefined, workbench: WorkbenchCore) => {
  const changes = useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
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
  const projected = resource ? resolveResourcePreview(resource, changes) : undefined;
  const changed = projected && projected !== resource;
  return changed ? { ...snapshot, label: projected.label } : snapshot;
};
