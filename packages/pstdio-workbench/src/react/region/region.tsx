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
  matchesWorkbenchLocationEligibility,
  matchesWorkbenchPanelMenuOwner,
  workbenchPanelMenuRegions,
} from "../../core";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getWorkbenchRegionBackground } from "../theme/workbench-theme-background";
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
  "sidebar-header",
  "main-header",
  "secondary-header",
  "side-header",
  "status",
]);

const panelMenuRegionIds = new Set<WorkbenchRegionId>(
  Object.values(workbenchPanelMenuRegions).flatMap((regions) => Object.values(regions)),
);

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
): WorkbenchWidgetPlacement[] => {
  const activePlacement = getActivePlacement(widgets, activeWidgetId);
  if (!activePlacement) return [];
  return widgets.filter(
    (placement) => placement.widgetId === activePlacement.widgetId || placement.mountStrategy === "keep-mounted",
  );
};

export const resolveRegionPlacementRenderState = (
  placement: WorkbenchWidgetPlacement,
  activeWidgetId: string | undefined,
) => {
  const active = placement.widgetId === activeWidgetId;
  return {
    active,
    display: "flex",
    pointerEvents: active ? "auto" : "none",
    position: active ? "relative" : "absolute",
    visibility: active ? "visible" : "hidden",
  } as const;
};

const createPlaceholderPlacement = (placeholder: RegisteredPlaceholderContribution): WorkbenchWidgetPlacement => ({
  widgetId: placeholder.id,
  contributionId: placeholder.id,
  title: placeholder.title,
  closable: false,
});

export const WorkbenchRegion = (props: WorkbenchRegionProps) => {
  const { workbench, region, title, pointerEvents = "auto", transparent = false } = props;
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
      )
    : undefined;
  const activeLocationPanel = getActiveWorkbenchLocationPanel(layout);
  const regionState = {
    ...currentRegionState,
    widgets: currentRegionState.widgets.filter((placement) => {
      const contribution = registeredWidgets[placement.contributionId];
      return contribution
        ? matchesWorkbenchLocationEligibility(contribution, locationResource, modeId, placement) &&
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
    ? resolveRenderedRegionPlacements(regionState.widgets, activePlacement.widgetId)
    : [];

  if (!placement) return null;

  const scrollsHorizontally = horizontalScrollRegions.has(region);

  // Interacting with a region makes its active widget the globally-active one (so clicking
  // into the Side Panel session sets it global-active) without touching the primary anchor,
  // which only follows `main`. Placeholders are not real widgets, so only activate a real
  // placement that is not already active.
  const activateOnInteract = () => {
    if (activePlacement && activePlacement.widgetId !== globalActiveWidgetId) {
      workbench.layout.activateWidget(activePlacement.widgetId);
    }
  };

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
      onPointerDown={activateOnInteract}
      onFocusCapture={activateOnInteract}
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
          renderedPlacements.map((renderedPlacement) => {
            const renderState = resolveRegionPlacementRenderState(renderedPlacement, activePlacement?.widgetId);

            return (
              <Box
                key={renderedPlacement.widgetId}
                display={renderState.display}
                flex={renderState.active ? "1 0 auto" : undefined}
                h={renderState.active ? undefined : "full"}
                inset={renderState.active ? undefined : "0"}
                minH="0"
                minW="0"
                overflow="hidden"
                pointerEvents={renderState.pointerEvents}
                position={renderState.position}
                visibility={renderState.visibility}
                w="full"
              >
                <WorkbenchWidgetHost workbench={workbench} placement={renderedPlacement} />
              </Box>
            );
          })
        )}
      </ScrollArea>
    </Flex>
  );
};
