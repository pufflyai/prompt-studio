import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { pageOwnerScope } from "./prepared-owner-states";

export const locatePagePlacements = (
  latest: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  placements: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
  states: readonly WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[] = [latest],
) =>
  placements.map((placement) => {
    if (placement.identity.kind !== "page") return placement;
    const main = placement.identity.slotId === "$main";
    const location = main
      ? states
          .filter(
            (state) =>
              pageOwnerScope(state) === pageOwnerScope(latest) &&
              state.activePageId === latest.activePageId &&
              resourceKey(state.location?.resource) === placement.value.resourceKey,
          )
          .at(-1)?.location
      : latest.location;
    if (!location) return placement;
    return {
      ...placement,
      value: {
        ...placement.value,
        pageContext: { mode: location.mode, parent: location.parent },
        ...(main ? { section: location.section, position: location.position } : {}),
      },
    };
  });

export const locatePreparedPageState = (
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  states: readonly WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[],
) => ({ ...state, placements: locatePagePlacements(state, state.placements, states) });
