import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContribution, WorkbenchPanelRenderInput, WorkbenchRegion } from "../../core";
import type { WorkbenchOverlayWidgetConfig } from "../../react";
import { RegionMapPlaceholder } from "./components/region-map-placeholder";
import {
  createRegionResource,
  describeSurface,
  regionLabels,
  regionResourceKind,
  regionWidgetId,
} from "./mock-data/regions";

const overlayConfig: WorkbenchOverlayWidgetConfig = {
  closeOnInteractOutside: false,
  modal: false,
};
const statusPanelId = regionWidgetId("status");
const mappedRegions = [
  "nav",
  "activity",
  "sidenav",
  "main-header",
  "main",
  "secondary-header",
  "secondary",
  "side-header",
  "side",
  "overlay",
] as const;
const panelRegions = ["main", "secondary", "side"] as const;
const RegionMapView = (props: { input: WorkbenchPanelRenderInput; region: WorkbenchRegion }) => {
  const { input, region } = props;
  const resource = createRegionResource(region);
  const placeholder = (
    <RegionMapPlaceholder
      region={region}
      role={describeSurface(region)}
      name={input.instance.resource?.label ?? input.instance.title ?? regionLabels[region]}
      uri={resourceKey(input.instance.resource) ?? resourceKey(resource)}
    />
  );
  if (region === "overlay")
    return (
      <Box position="relative" h="full" w="full">
        {placeholder}
      </Box>
    );
  if (region !== "main") return placeholder;
  return (
    <Stack h="full" w="full" minH="0" minW="0" gap="0">
      <Box flex="1" minH="0">
        {placeholder}
      </Box>
      <HStack justifyContent="center" p="md">
        <Button
          size="sm"
          variant="subtle"
          onClick={() => input.workbench.overlays.openOverlay(regionWidgetId("overlay"))}
        >
          Show overlay
        </Button>
      </HStack>
    </Stack>
  );
};
const panelMenuRegion = (panel: (typeof panelRegions)[number], side: "left" | "right") =>
  `${panel}-${side}-menu` as const;
const isPanelRegion = (region: WorkbenchRegion): region is (typeof panelRegions)[number] =>
  panelRegions.some((panel) => panel === region);
export const createRegionMapModule = (): WorkbenchModuleContribution => ({
  id: "region-map",
  activate(ctx) {
    ctx.sidePanel.setMode("attached");
    ctx.resources.registerKind({ kind: regionResourceKind, label: "Workbench region", icon: "SquareDashed" });
    ctx.views.registerView({
      id: statusPanelId,
      title: regionLabels.status,
      body: {
        kind: "react",
        render: () => (
          <RegionMapPlaceholder
            region="status"
            role={describeSurface("status")}
            name={regionLabels.status}
            uri={resourceKey(createRegionResource("status"))}
          />
        ),
      },
    });
    ctx.statusBar.registerItem({ id: `${statusPanelId}.item`, viewId: statusPanelId, slot: "leading" });
    for (const region of mappedRegions) {
      ctx.views.registerView({
        id: regionWidgetId(region),
        title: regionLabels[region],
        body: { kind: "react", render: (input) => <RegionMapView input={input} region={region} /> },
      });
      if (region === "overlay") {
        ctx.overlays.registerOverlay({
          id: regionWidgetId(region),
          viewId: regionWidgetId(region),
          config: overlayConfig,
        });
      } else if (!isPanelRegion(region)) {
        ctx.shellPlacements.registerPlacement({
          id: regionWidgetId(region),
          item: {
            kind: "view",
            presence: "fixed",
            view: {
              kind: "view",
              id: regionWidgetId(region),
            },
          },
          region,
        });
      }
    }
    for (const panel of panelRegions) {
      for (const side of ["left", "right"] as const) {
        const region = panelMenuRegion(panel, side);
        const menuViewId = regionWidgetId(region);
        ctx.views.registerView({
          id: menuViewId,
          title: regionLabels[region],
          body: { kind: "react", render: (input) => <RegionMapView input={input} region={region} /> },
        });
        ctx.viewMenus.registerViewMenu({
          id: menuViewId,
          ownerViewId: regionWidgetId(panel),
          viewId: menuViewId,
          side,
          regionSize: { defaultPx: 160, minPx: 120 },
        });
      }
      ctx.shellPlacements.registerPlacement({
        id: regionWidgetId(panel),
        item: {
          kind: "view",
          presence: "fixed",
          view: {
            kind: "view",
            id: regionWidgetId(panel),
          },
        },
        region: panel,
      });
    }
  },
});
