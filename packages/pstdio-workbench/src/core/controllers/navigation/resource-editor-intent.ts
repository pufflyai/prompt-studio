import type { PageOpenIntent, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchCore } from "../../workbench-core-types";
import { updateSavedTransferredEditor } from "../page-runtime/open-owner-layouts";

export interface ResourceEditorIntent {
  resource?: ResourceRef;
  open?: PageOpenIntent;
  title?: string;
}

export const resourceEditorIntent = (target: NavigationTargetPage | NavigationTargetPanel | undefined) => ({
  resource: target?.resource,
  open: target?.open,
  ...(target && "title" in target ? { title: target.title } : {}),
});

export const applyResourceEditorIntent = (
  core: WorkbenchCore,
  previous: WorkbenchWidgetPlacement,
  tab: WorkbenchWidgetPlacement | undefined,
  intent: ResourceEditorIntent,
) => {
  if (!tab) {
    updateSavedTransferredEditor(core, previous, {
      resource: intent.resource,
      title: intent.title,
      ...(intent.open === "pin" ? { pinned: true, tabRetention: "persistent" } : {}),
    });
    return;
  }
  const identity = tab.placementIdentity;
  const resourceChanged = intent.resource && intent.resource !== tab.resource;
  const titleChanged = intent.title !== undefined && intent.title !== tab.title;
  if (resourceChanged || titleChanged) {
    if (tab.declarationIdentity)
      core.layout.updateWidgetPlacement(tab.widgetId, { resource: intent.resource, title: intent.title });
    else if (identity?.kind === "page" && identity.slotId !== "$main")
      core.pages.openSlot({ pageId: identity.pageId, slotId: identity.slotId, resource: intent.resource });
    else if (identity?.kind === "mode")
      core.modePlacements.updatePlacement(identity, { resource: intent.resource, title: intent.title });
    else if (identity?.kind === "shell")
      core.shellPlacements.updatePlacement(identity, { resource: intent.resource, title: intent.title });
  }
  if (intent.open === "pin" && identity) core.pinPlacement(identity);
};
