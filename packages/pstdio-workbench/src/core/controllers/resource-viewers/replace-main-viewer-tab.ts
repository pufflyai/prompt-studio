import type { NavigationTargetViewer, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";
import { pageLocationTarget } from "../page-location/page-location-target";

export const replaceMainViewerTab = (
  core: WorkbenchCore,
  viewer: { identity: Extract<PlacementIdentity, { kind: "page" }>; widget: WorkbenchWidgetPlacement },
  request: Omit<NavigationTargetViewer, "kind">,
) => {
  const { identity } = viewer;
  const main = core.layout.getLayout().regions.main;
  const nextSibling = main.widgets[main.widgets.findIndex((tab) => tab.widgetId === viewer.widget.widgetId) + 1];
  const selected = core.layout.getLayout().activeWidgetId;
  const page = core.pages.getPage(identity.pageId)!;
  const context = viewer.widget.pageContext ?? core.pages.store.getState().location!;
  const result = core.pageLocations.navigate({
    ...pageLocationTarget({ ...context, page: page.ref }),
    resource: request.resource,
    section: request.section,
    position: request.position,
    ...(page.main.kind === "view" && page.main.cardinality === "many"
      ? { open: viewer.widget.tabRetention === "persistent" ? ("pin" as const) : ("preview" as const) }
      : {}),
  });
  if (!result.ok) throw new Error(result.diagnostic.message);
  const replacement = core.layout.getActivePanel("main")!;
  core.closePlacement(identity);
  if (nextSibling) core.layout.reorderPanel(replacement.instanceId, { beforeWidgetId: nextSibling.widgetId });
  if (request.operation === "replace" && selected && selected !== viewer.widget.widgetId)
    core.layout.activatePanel(selected);
};
