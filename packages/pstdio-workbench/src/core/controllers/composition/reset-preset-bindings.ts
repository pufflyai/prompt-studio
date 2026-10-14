import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { pageSlots } from "../../registries/pages/page-main";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchPageRuntimeState } from "../../registries/pages/page-registry-types";
import { openResourceSlot } from "../../registries/pages/page-slot-lifecycle";
import { type OwnedPlacementState, openResourcePlacement } from "../../registries/placements/owned-placement-lifecycle";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";
import { readOwnerLayout } from "../page-runtime/open-owner-layouts";
import { modeLayoutScope } from "../page-runtime/owner-layout-scope";
import { presetDeclaration } from "./preset-declaration";

export const resetOwnerScope = (core: WorkbenchCore, owner: "page" | "mode") => {
  const state = core.pages.store.getState();
  return owner === "page"
    ? core.layout.getPersistenceScope()
    : modeLayoutScope(state.projectId, state.activeModeId ?? core.modes.getActiveModeId() ?? "");
};

export const closedResetPresets = (core: WorkbenchCore, owner: "page" | "mode") => {
  const scope = resetOwnerScope(core, owner);
  return (readOwnerLayout(core, scope)?.closedPresets ?? []).filter((tab) => {
    if (!tab.placementIdentity || (tab.resource && core.resources.isRemoved(tab.resource))) return false;
    const declaration = presetDeclaration(core, tab.placementIdentity);
    if (!declaration) return false;
    if (
      declaration.item.kind === "binding" &&
      (!tab.resource || !resourceMatchesConstraint(declaration.item.binding, tab.resource))
    )
      return false;
    if (!tab.resource) return true;
    try {
      getWorkbenchPageRegistryInternals(core.pages).resources.normalize(tab.resource);
      return true;
    } catch {
      return false;
    }
  });
};

export const restorePresetBindings = (
  core: WorkbenchCore,
  closed: WorkbenchWidgetPlacement[],
  pageState: WorkbenchPageRuntimeState,
  modeState: OwnedPlacementState,
) => {
  let state = pageState;
  for (const tab of closed) {
    const identity = tab.placementIdentity!;
    const declaration = presetDeclaration(core, identity);
    if (!declaration || declaration.item.kind !== "binding" || !tab.resource) continue;
    if (identity.kind === "page") {
      const page = core.pages.getPage(identity.pageId);
      const slot = page && pageSlots(page).find((p) => p.id === identity.slotId);
      if (!slot) continue;
      if (state.resourceInstances[identity.slotId]?.length) continue;
      state = openResourceSlot({
        slot: { ...slot, role: identity.slotId === "$main" ? "primary" : "auxiliary" },
        state,
        target: { pageId: identity.pageId, resource: tab.resource },
        resourceKey,
      });
    } else {
      if (modeState.resourceInstances.get(identity.placementId)?.length) continue;
      openResourcePlacement({
        label: "Preset",
        id: identity.placementId,
        item: declaration.item,
        state: modeState,
        resource: tab.resource,
      });
    }
  }
  return state;
};
