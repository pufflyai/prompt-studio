import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchCore } from "../../workbench-core-types";
import { pageLocationTarget } from "../page-location/page-location-target";
import { modeLayoutScope } from "../page-runtime/owner-layout-scope";
import { pageOwnerScope, preparedOwnerStates } from "../page-runtime/prepared-owner-states";

export const isResourceEditorInOwner = (
  editor: { scope?: string; tab: WorkbenchWidgetPlacement },
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const identity = editor.tab.placementIdentity;
  if (identity?.kind === "mode") return identity.modeId === state.activeModeId;
  if (identity?.kind === "page" || identity?.kind === "shell") return editor.scope === pageOwnerScope(state);
  return true;
};

export const hasPreparedEditorOwner = (
  editor: { scope?: string; tab: WorkbenchWidgetPlacement },
  states: readonly WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[],
) => {
  const identity = editor.tab.placementIdentity;
  if (!identity) return false;
  const key = placementIdentityKey(identity);
  return states.some(
    (state) =>
      isResourceEditorInOwner(editor, state) &&
      [...state.placements, ...state.reconciliation.remove].some((p) => placementIdentityKey(p.identity) === key),
  );
};

export const findPreparedResourceEditor = (
  core: WorkbenchCore,
  viewId: string,
  resource: ResourceRef,
  states: readonly WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[],
) => {
  if (core.views.getView(viewId)?.instancePolicy !== "per-resource") return undefined;
  const normalized = getWorkbenchPageRegistryInternals(core.pages).resources.normalize(resource);
  const modeStates = new Map<string, WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>>();
  for (const state of states) if (state.activeModeId) modeStates.set(state.activeModeId, state);
  const pages = [...preparedOwnerStates(states).values()];
  const modes = [...modeStates.values()];
  const candidates = [
    ...pages.flatMap((state) =>
      state.placements.filter((p) => p.identity.kind !== "mode").map((placement) => ({ state, placement })),
    ),
    ...modes.flatMap((state) =>
      state.placements.filter((p) => p.identity.kind === "mode").map((placement) => ({ state, placement })),
    ),
  ];
  const found = candidates.find(
    ({ placement }) =>
      placement.value.viewId === viewId && resourceKey(placement.value.resource) === resourceKey(normalized),
  );
  if (!found) return undefined;
  const { state, placement } = found;
  const location =
    state.location && placement.identity.kind === "page" && placement.identity.slotId === "$main"
      ? {
          ...state.location,
          ...placement.value.pageContext,
          resource: placement.value.resource,
          section: placement.value.section,
          position: placement.value.position,
        }
      : state.location;
  return {
    editor: {
      scope:
        placement.identity.kind === "mode"
          ? modeLayoutScope(state.projectId, placement.identity.modeId)
          : pageOwnerScope(state),
      region: placement.region,
      tab: { ...placement.value, placementIdentity: placement.identity },
    },
    owner: location ? pageLocationTarget(location) : undefined,
  };
};
