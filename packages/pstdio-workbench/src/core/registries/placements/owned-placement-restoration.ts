import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchWidgetPlacement } from "../layout/layout-types";
import type { OwnedPlacementState, WorkbenchOwnedPlacementItem } from "./owned-placement-lifecycle";

export const restoreOwnedPlacementState = (input: {
  state: OwnedPlacementState;
  declarations: readonly { id: string; item: WorkbenchOwnedPlacementItem }[];
  saved: readonly WorkbenchWidgetPlacement[];
  owns(identity: PlacementIdentity): boolean;
}) => {
  const state = {
    staticOverrides: new Map(input.state.staticOverrides),
    resourceInstances: new Map(input.state.resourceInstances),
  };
  for (const placement of input.declarations) {
    const saved = input.saved.filter((candidate) => {
      const identity = candidate.placementIdentity;
      return identity && input.owns(identity) && identity.kind !== "page" && identity.placementId === placement.id;
    });
    if (placement.item.kind === "view") {
      state.staticOverrides.set(placement.id, saved.length ? "open" : "closed");
      continue;
    }
    const binding = placement.item.binding;
    const instances = saved.flatMap((candidate) => {
      if (
        !candidate.resource ||
        !candidate.placementIdentity ||
        !resourceMatchesConstraint(binding, candidate.resource)
      )
        return [];
      return [
        {
          instanceKey: candidate.placementIdentity.instanceKey,
          resource: candidate.resource,
          title: candidate.title,
          ...(binding.cardinality === "many"
            ? { open: candidate.tabRetention === "preview" ? ("preview" as const) : ("pin" as const) }
            : {}),
        },
      ];
    });
    state.resourceInstances.set(placement.id, binding.cardinality === "one" ? instances.slice(-1) : instances);
  }
  return state;
};
