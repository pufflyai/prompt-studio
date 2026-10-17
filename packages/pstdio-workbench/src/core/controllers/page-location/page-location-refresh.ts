import type { WorkbenchPageRuntimeState } from "../../registries/pages/page-registry";

// Metadata hydration refreshes existing views. Only navigation opens resources.
export const refreshOpenPageInstances = (
  current: Readonly<Record<string, WorkbenchPageRuntimeState>>,
  refreshed: Readonly<Record<string, WorkbenchPageRuntimeState>>,
) =>
  Object.fromEntries(
    Object.entries(current).map(([key, state]) => [
      key,
      {
        ...state,
        resourceInstances: Object.fromEntries(
          Object.entries(state.resourceInstances).map(([slot, instances]) => [
            slot,
            instances.map(
              (instance) =>
                refreshed[key]?.resourceInstances[slot]?.find(
                  (candidate) => candidate.instanceKey === instance.instanceKey,
                ) ?? instance,
            ),
          ]),
        ),
      },
    ]),
  );
