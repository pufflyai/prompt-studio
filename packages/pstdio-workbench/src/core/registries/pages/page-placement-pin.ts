import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRegistryStoreState, WorkbenchPageResourceCodec } from "./page-registry-types";
import { pageStateKey } from "./page-state-key";

export const pinPagePlacement = <Value>(
  state: WorkbenchPageRegistryStoreState<Value>,
  identity: PlacementIdentity,
  resources: WorkbenchPageResourceCodec,
) => {
  if (identity.kind !== "page" || state.activePageId !== identity.pageId)
    throw new Error("Only an active page placement can be pinned");
  const page = state.pages[identity.pageId]!;
  const key = pageStateKey(page, state.location, resources);
  const current = state.pageStates[key]!;
  const instances = current.resourceInstances[identity.slotId] ?? [];
  if (!instances.some((instance) => instance.instanceKey === identity.instanceKey))
    throw new Error("Only an open resource placement can be pinned");
  return {
    ...state,
    pageStates: {
      ...state.pageStates,
      [key]: {
        ...current,
        resourceInstances: {
          ...current.resourceInstances,
          [identity.slotId]: instances.map((instance) =>
            instance.instanceKey === identity.instanceKey ? { ...instance, open: "pin" as const } : instance,
          ),
        },
      },
    },
  };
};
