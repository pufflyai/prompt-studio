import type { NavigationTargetViewer, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import type { WorkbenchCore } from "../../workbench-core-types";
import { prepareWorkbenchNavigation } from "../navigation/compound-navigation";
import { portablePagePanel, portablePageSlotPanel } from "../page-runtime/portable-page-panel";
import { resourceViewerBinding } from "./displayed-viewers";

const resolveViewerPanel = (
  core: WorkbenchCore,
  identity: PlacementIdentity,
  request: Omit<NavigationTargetViewer, "kind">,
) => {
  const item = resourceViewerBinding(core, identity);
  let panel: NavigationTargetPanel["panel"] | undefined;
  if (item?.kind === "view" && request.page) {
    const page = core.pages
      .listPages()
      .find((page) => page.ref.id === request.page!.id && page.ref.extensionId === request.page!.extensionId)!;
    panel = portablePagePanel(page, core.modePlacements);
  } else if (identity.kind === "mode") {
    const id = identity.placementId;
    panel = core.modePlacements.listPlacements().find((entry) => entry.id === id)?.ref;
  } else if (identity.kind === "shell") panel = { kind: "shell-placement", id: identity.placementId };
  else {
    const page = core.pages.getPage(identity.pageId);
    if (page && identity.slotId !== "$main")
      panel =
        page.id === core.pages.store.getState().activePageId
          ? { kind: "page-slot", page: page.ref, id: identity.slotId }
          : portablePageSlotPanel(page, identity.slotId);
  }
  return panel;
};

export const navigatePanelViewer = (
  core: WorkbenchCore,
  viewer: { widget: WorkbenchWidgetPlacement; identity: PlacementIdentity; region: WorkbenchPanelRegion },
  request: Omit<NavigationTargetViewer, "kind">,
) => {
  const panel = resolveViewerPanel(core, viewer.identity, request);
  if (!panel) return false;
  const binding =
    panel.kind === "placement"
      ? core.modePlacements.getPlacement(panel)?.item
      : resourceViewerBinding(core, viewer.identity);
  const selected = core.layout.getLayout().activeWidgetId;
  const focus = core.focus.getActiveRegion();
  const common = {
    kind: "panel" as const,
    resource: request.resource,
    region: viewer.region,
    ...(binding?.kind === "binding" && binding.binding.cardinality === "many" ? { open: "pin" as const } : {}),
  };
  const target: NavigationTargetPanel = panel.kind === "shell-placement" ? { ...common, panel } : { ...common, panel };
  prepareWorkbenchNavigation(core, [target], {
    replace: viewer.widget,
    location: {
      ...request,
      pageContext: request.page ? { ...viewer.widget.pageContext, page: request.page } : viewer.widget.pageContext,
    },
  }).commit();
  if (request.operation === "replace" && selected && selected !== viewer.widget.widgetId) {
    core.layout.activatePanel(selected);
    if (focus) core.focus.setActiveRegion(focus);
  }
  return true;
};
