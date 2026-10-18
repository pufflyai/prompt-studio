import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRuntimeState } from "./page-registry-types";

export type PagePlacementEdit = { kind: "close" } | { kind: "retention"; open: "pin" | "preview" };

// A shared tab can outlive its source location. Edit its owner instances without
// assuming that the current route still belongs to that owner.
export const editPagePlacementStates = (
  states: Readonly<Record<string, WorkbenchPageRuntimeState>>,
  identity: Extract<PlacementIdentity, { kind: "page" }>,
  edit: PagePlacementEdit,
) =>
  Object.fromEntries(
    Object.entries(states).map(([key, current]) => {
      if (key !== identity.pageId && !key.startsWith(`${identity.pageId}|`)) return [key, current];
      const instances = current.resourceInstances[identity.slotId] ?? [];
      const remaining = instances.flatMap((instance) => {
        if (instance.instanceKey !== identity.instanceKey) return [instance];
        return edit.kind === "close" ? [] : [{ ...instance, open: edit.open }];
      });
      return [
        key,
        {
          ...current,
          openStaticSlotIds:
            edit.kind === "close" && identity.instanceKey === "default"
              ? current.openStaticSlotIds.filter((id) => id !== identity.slotId)
              : current.openStaticSlotIds,
          resourceInstances: { ...current.resourceInstances, [identity.slotId]: remaining },
          activePrimaryInstanceKey:
            edit.kind === "close" && current.activePrimaryInstanceKey === identity.instanceKey
              ? remaining.at(-1)?.instanceKey
              : current.activePrimaryInstanceKey,
        },
      ];
    }),
  );
