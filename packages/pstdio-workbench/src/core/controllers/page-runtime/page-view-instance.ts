import type { LayoutModel } from "../../registries/layout/layout-model";
import { createPlacement } from "../../registries/layout/layout-operations";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPagePlacementInput } from "../../registries/pages/page-registry";
import { pagePlacementContributionId } from "../../registries/views/view-placement";
import type { WorkbenchViewRegistry } from "../../registries/views/view-registry";

const toTabState = (open: WorkbenchPagePlacementInput["open"]) => {
  if (!open) return {};
  if (open === "pin") return { pinned: true, tabRetention: "persistent" as const };
  return { pinned: false, tabRetention: "preview" as const };
};
export const toWidgetPlacement = (
  input: WorkbenchPagePlacementInput,
  layout: LayoutModel,
  views: WorkbenchViewRegistry,
) => {
  const resource = input.resource;
  const view = views.getView(input.viewId);
  if (!view) throw new Error(`Workbench page view is not registered: ${input.viewId}`);
  const panelId = pagePlacementContributionId(input.pageId, input.slotId);
  const panel = layout.getWidget(panelId);
  if (!panel) throw new Error(`Workbench page placement is not registered: ${input.pageId}.${input.slotId}`);
  return {
    ...createPlacement(`workbench.page.${encodeURIComponent(placementIdentityKey(input.identity))}`, panel, {
      viewId: input.viewId,
      title: resource?.label ?? view.title ?? panel.title,
      role: input.role === "primary" ? "location" : "sub-panel",
      closable: input.closable,
      ...(resource ? { resource } : {}),
      ...toTabState(input.open),
    }),
    ...(input.section ? { section: input.section } : {}),
    ...(input.position ? { position: input.position } : {}),
    pageContext: input.pageContext,
    placementIdentity: input.identity,
  };
};
