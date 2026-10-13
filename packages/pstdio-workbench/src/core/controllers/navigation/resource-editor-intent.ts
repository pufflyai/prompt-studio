import type {
  FileRendererSectionTarget,
  FileSourcePosition,
  PageOpenIntent,
  ResourceRef,
} from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchCore } from "../../workbench-core-types";
import { updateSavedTransferredEditor } from "../page-runtime/open-owner-layouts";

export interface ResourceEditorIntent {
  resource?: ResourceRef;
  open?: PageOpenIntent;
  title?: string;
  section?: FileRendererSectionTarget;
  position?: FileSourcePosition;
}

export const resourceEditorIntent = (target: NavigationTargetPage | NavigationTargetPanel | undefined) => ({
  resource: target?.resource,
  open: target?.open,
  ...(target?.kind === "page" ? { section: target.section, position: target.position } : {}),
  ...(target && "title" in target ? { title: target.title } : {}),
});

const applyEditorSourceTarget = (core: WorkbenchCore, widgetId: string, intent: ResourceEditorIntent) => {
  if (intent.section === undefined && intent.position === undefined) return;
  const layout = core.layout.getLayout();
  const regions = { ...layout.regions };
  for (const region of Object.values(regions)) {
    regions[region.id] = {
      ...region,
      widgets: region.widgets.map((value) =>
        value.widgetId === widgetId ? { ...value, section: intent.section, position: intent.position } : value,
      ),
    };
  }
  core.layout.restoreLayout({ ...layout, regions });
};

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
      section: intent.section,
      position: intent.position,
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
  applyEditorSourceTarget(core, tab.widgetId, intent);
  if (intent.open === "pin" && identity) core.pinPlacement(identity);
};
