import type { PageOpenIntent, ResourceRef } from "@pstdio/sdk/extensions";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { pageSlots } from "../../registries/pages/page-main";
import { placementItemViewId } from "../../registries/placements/owned-placement-lifecycle";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";
import { prepareWorkbenchNavigation } from "./compound-navigation";
import { findOpenResourceEditor, prepareEditorActivation } from "./resource-editor-resolver";

export interface OpenWorkbenchViewInput {
  viewId: string;
  resource: ResourceRef;
  open?: PageOpenIntent;
}

/** Resource creation never calls this explicit UI operation. */
export const openWorkbenchView = (core: WorkbenchCore, input: OpenWorkbenchViewInput) => {
  const { viewId, resource, open } = input;
  const view = core.views.getView(viewId);
  if (!view) throw new Error(`View is unavailable: ${viewId}`);
  const existing = findOpenResourceEditor(core, viewId, resource);
  if (existing) return prepareEditorActivation(core, existing, [], undefined, { resource, open }).commit();
  const state = core.pages.store.getState();
  const page = state.activePageId ? state.pages[state.activePageId] : undefined;
  const accepts = (item: Parameters<typeof placementItemViewId>[0]) =>
    item.kind === "binding" &&
    placementItemViewId(item) === viewId &&
    resourceMatchesConstraint(item.binding, resource);
  const slot = page && pageSlots(page).find((slot) => accepts(slot.item));
  let target: NavigationTargetPanel | NavigationTargetPage | undefined;
  if (page && slot) {
    if (slot.role === "primary") target = { kind: "page", page: page.ref, resource, open };
    else target = { kind: "panel", panel: { kind: "page-slot", page: page.ref, id: slot.id }, resource, open };
  } else {
    const mode = core.modePlacements.listPlacements(state.activeModeId ?? core.modes.getActiveModeId());
    const placement = mode.find((placement) => placement.region === view.defaultPanel && accepts(placement.item));
    const shell = core.shellPlacements
      .listPlacements()
      .find((placement) => placement.region === view.defaultPanel && accepts(placement.item));
    if (placement) target = { kind: "panel", panel: placement.ref, resource, open };
    else if (shell) target = { kind: "panel", panel: { kind: "shell-placement", id: shell.id }, resource, open };
  }
  if (!target) throw new Error(`View has no declared destination: ${viewId}`);
  return prepareWorkbenchNavigation(core, [target]).commit();
};
