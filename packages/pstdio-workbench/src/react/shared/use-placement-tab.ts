import { useEffect, useState } from "react";
import type { WorkbenchTabSnapshot, WorkbenchWidgetPlacement } from "../../core";
import { toPanelInstance } from "../../core/registries/layout/panel-api";

const readPlacementTab = (placement: WorkbenchWidgetPlacement | undefined) =>
  placement?.tab?.getSnapshot(toPanelInstance(placement)) ?? {};

export const usePlacementTab = (placement: WorkbenchWidgetPlacement | undefined) => {
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
  return state.placement === placement ? state.snapshot : readPlacementTab(placement);
};
