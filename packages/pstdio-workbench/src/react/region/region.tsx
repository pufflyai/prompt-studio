import { Box, Flex } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type {
  RegisteredPlaceholderContribution,
  WorkbenchCore,
  WorkbenchPanelMenuRegion,
  WorkbenchRegion as WorkbenchRegionId,
  WorkbenchWidgetPlacement,
} from "../../core";
import {
  getActiveWorkbenchLocationPanel,
  getActiveWorkbenchSubPanel,
  getWorkbenchPanelForMenuRegion,
  isWorkbenchPanelPlacementVisible,
  matchesWorkbenchModeEligibility,
  matchesWorkbenchPanelMenuOwner,
  workbenchPanelMenuRegions,
} from "../../core";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getWorkbenchRegionBackground } from "../theme/workbench-theme-background";
import { ModeChromeView, useModeChrome } from "./mode-chrome";
import { WorkbenchWidgetHost } from "./widget-host";

interface WorkbenchRegionProps {
  workbench: WorkbenchCore;
  region: WorkbenchRegionId;
  title?: string;
  pointerEvents?: "auto" | "none";
  transparent?: boolean;
}

// Header bars and the status bar lay their content out in a row, so they
// scroll on the X axis; every other region scrolls vertically.
const horizontalScrollRegions = new Set<WorkbenchRegionId>([
  "nav",
  "main-header",
  "secondary-header",
  "side-header",
  "status",
]);

const panelMenuRegionIds = new Set<WorkbenchRegionId>(
  Object.values(workbenchPanelMenuRegions).flatMap((regions) => Object.values(regions)),
);
const sidePanelRegionIds = new Set<WorkbenchRegionId>(["side", "side-header", "side-left-menu", "side-right-menu"]);

// A flex column at least as tall as the viewport lets a widget fill the region
// (e.g. a tree with a pinned footer) while still growing and scrolling.
const verticalContentProps = { display: "flex", flexDirection: "column", minH: "100%", position: "relative" } as const;

// Horizontal header regions need a definite content height so full-height
// controls can stretch through the ScrollArea's content wrapper.
const horizontalContentProps = {
  display: "flex",
  alignItems: "stretch",
  h: "full",
  minH: "100%",
  position: "relative",
} as const;

const getActivePlacement = (widgets: WorkbenchWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

export const resolveRenderedRegionPlacements = (
  widgets: WorkbenchWidgetPlacement[],
  activeWidgetId?: string,
  region?: WorkbenchRegionId,
): WorkbenchWidgetPlacement[] => {
  if (region === "sidenav") return widgets;
  const activePlacement = getActivePlacement(widgets, activeWidgetId);
  if (!activePlacement) return [];
  return widgets.filter(
    (placement) => placement.widgetId === activePlacement.widgetId || placement.mountStrategy === "keep-mounted",
  );
};

export const resolveRegionPlacementRenderState = (
  placement: WorkbenchWidgetPlacement,
  activeWidgetId: string | undefined,
  region?: WorkbenchRegionId,
) => {
  const active = placement.widgetId === activeWidgetId;
  const additive = region === "sidenav";
  return {
    active,
    display: "flex",
    pointerEvents: active || additive ? "auto" : "none",
    position: active || additive ? "relative" : "absolute",
    visibility: active || additive ? "visible" : "hidden",
  } as const;
};

const createPlaceholderPlacement = (placeholder: RegisteredPlaceholderContribution): WorkbenchWidgetPlacement => ({
  widgetId: placeholder.id,
  contributionId: placeholder.id,
  title: placeholder.title,
  closable: false,
});

interface WorkbenchRegionPlacementProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  activeWidgetId?: string;
  globalActiveWidgetId?: string;
  region: WorkbenchRegionId;
}

const WorkbenchRegionPlacement = (props: WorkbenchRegionPlacementProps) => {
  const { workbench, placement, activeWidgetId, globalActiveWidgetId, region } = props;
  const renderState = resolveRegionPlacementRenderState(placement, activeWidgetId, region);
  const additive = region === "sidenav";
  const overlaysActivePlacement = !renderState.active && !additive;
  let flex: string | undefined;
  if (additive) flex = "1 1 0";
  else if (renderState.active) flex = "1 0 auto";

  const activatePlacement = () => {
    if (placement.widgetId !== globalActiveWidgetId) workbench.layout.activatePanel(placement.widgetId);
  };

  return (
    <Box
      display={renderState.display}
      flex={flex}
      h={overlaysActivePlacement ? "full" : undefined}
      inset={overlaysActivePlacement ? "0" : undefined}
      minH="0"
      minW="0"
      onPointerDown={additive ? activatePlacement : undefined}
      onFocusCapture={additive ? activatePlacement : undefined}
      overflow="hidden"
      pointerEvents={renderState.pointerEvents}
      position={renderState.position}
      visibility={renderState.visibility}
      w="full"
    >
      <WorkbenchWidgetHost workbench={workbench} placement={placement} />
    </Box>
  );
};

export const WorkbenchRegion = (props: WorkbenchRegionProps) => {
  const { workbench, region, title, pointerEvents = "auto", transparent = false } = props;
  const chrome = useModeChrome(workbench, region);
  const locationResource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const currentRegionState = layout.regions[region];
  const registeredWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.widgets);
  const activeSubPanel = panelMenuRegionIds.has(region)
    ? getActiveWorkbenchSubPanel(
        layout,
        getWorkbenchPanelForMenuRegion(region as WorkbenchPanelMenuRegion),
        locationResource,
        { ignoreOwnerResourceUri: sidePanelRegionIds.has(region) },
      )
    : undefined;
  const activeLocationPanel = getActiveWorkbenchLocationPanel(layout);
  const regionState = {
    ...currentRegionState,
    widgets: currentRegionState.widgets.filter((placement) => {
      const contribution = registeredWidgets[placement.contributionId];
      return contribution
        ? (sidePanelRegionIds.has(region)
            ? matchesWorkbenchModeEligibility(contribution, modeId)
            : isWorkbenchPanelPlacementVisible(contribution, locationResource, modeId, placement, {
                location: activeLocationPanel,
              })) &&
            matchesWorkbenchPanelMenuOwner(contribution, {
              locationPanel: activeLocationPanel,
              subPanel: activeSubPanel,
            })
        : false;
    }),
  };
  const globalActiveWidgetId = useWorkbenchStore(workbench.layout.store, (state) => state.layout.activeWidgetId);
  const activePlacement = getActivePlacement(regionState.widgets, regionState.activeWidgetId);
  const placeholder = activePlacement ? undefined : workbench.layout.getPlaceholder(region);
  const placement = activePlacement ?? (placeholder ? createPlaceholderPlacement(placeholder) : undefined);
  const renderedPlacements = activePlacement
    ? resolveRenderedRegionPlacements(regionState.widgets, activePlacement.widgetId, region)
    : [];

  if (chrome === false) return null;
  if (chrome) return <ModeChromeView workbench={workbench} region={region} viewId={chrome} />;
  if (!placement) return null;

  const scrollsHorizontally = horizontalScrollRegions.has(region);

  // Interacting with a region makes its active widget the globally-active one (so clicking
  // into the Side Panel session sets it global-active) without touching the primary anchor,
  // which only follows `main`. Placeholders are not real widgets, so only activate a real
  // placement that is not already active.
  const activatePlacement = (target: WorkbenchWidgetPlacement | undefined) => {
    if (target && target.widgetId !== globalActiveWidgetId) {
      workbench.layout.activatePanel(target.widgetId);
    }
  };
  const additive = region === "sidenav";

  return (
    <Flex
      as="section"
      direction="column"
      h="full"
      minH="0"
      minW="0"
      w="full"
      bg={transparent ? "transparent" : getWorkbenchRegionBackground(region)}
      overflow="hidden"
      pointerEvents={pointerEvents}
      aria-label={title ?? region}
      onPointerDown={additive ? undefined : () => activatePlacement(activePlacement)}
      onFocusCapture={additive ? undefined : () => activatePlacement(activePlacement)}
    >
      {/* The region owns scrolling: overflowing widget content scrolls here
          with the same narrow overlay scrollbar used across the workbench. */}
      <ScrollArea
        flex="1"
        minH="0"
        minW="0"
        w="full"
        size="xs"
        showVerticalScrollbar={!scrollsHorizontally}
        showHorizontalScrollbar={scrollsHorizontally}
        // Horizontal bars hold a single row that should stay vertically
        // centered; the ScrollArea otherwise top-aligns its flowing content.
        viewportProps={scrollsHorizontally ? { justifyContent: "center" } : undefined}
        // Vertical regions host a flex column so a widget can fill the region
        // (e.g. a tree with a pinned footer) yet still grow and scroll.
        contentProps={scrollsHorizontally ? horizontalContentProps : verticalContentProps}
      >
        {placeholder ? (
          <WorkbenchWidgetHost workbench={workbench} placement={placement} widget={placeholder} />
        ) : (
          renderedPlacements.map((renderedPlacement) => (
            <WorkbenchRegionPlacement
              key={renderedPlacement.widgetId}
              workbench={workbench}
              placement={renderedPlacement}
              activeWidgetId={activePlacement?.widgetId}
              globalActiveWidgetId={globalActiveWidgetId}
              region={region}
            />
          ))
        )}
      </ScrollArea>
    </Flex>
  );
};
