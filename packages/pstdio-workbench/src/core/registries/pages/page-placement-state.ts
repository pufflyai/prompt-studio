import type { PlacementIdentity, ResourceRef, ViewLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRuntimeState } from "./page-registry-types";
import { ownsStaticPageInstance } from "./page-state-key";

export type PagePlacementEdit =
  | { kind: "close" }
  | { kind: "retention"; open: "pin" | "preview" }
  | ({ kind: "reference"; resource: ResourceRef } & ViewLocation);

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
        if (edit.kind === "close") return [];
        if (edit.kind === "reference")
          return [
            {
              ...instance,
              resource: edit.resource,
              section: edit.section,
              position: edit.position,
              pageContext: edit.pageContext ?? instance.pageContext,
            },
          ];
        return [{ ...instance, open: edit.open }];
      });
      return [
        key,
        {
          ...current,
          openStaticSlotIds:
            edit.kind === "close" && ownsStaticPageInstance(key, identity.pageId, identity.instanceKey)
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
