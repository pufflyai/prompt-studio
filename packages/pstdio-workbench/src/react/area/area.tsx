import { Box, Flex } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { RegisteredPlaceholderContribution, SlotId, WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { getActiveWidgetId, getAnchorResource, listPanelTabPlacements } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getWorkbenchAreaBackground } from "../theme/workbench-theme-background";
import { filterSidePanelPlacements } from "./side-panel-placements";
import { WorkbenchWidgetHost } from "./widget-host";

interface WorkbenchAreaProps {
  workbench: WorkbenchCore;
  area: SlotId;
  title?: string;
  pointerEvents?: "auto" | "none";
  transparent?: boolean;
}

// Header bars and the status bar lay their content out in a row, so they
// scroll on the X axis; every other area scrolls vertically.
const horizontalScrollAreas = new Set<SlotId>(["nav", "status"]);

// A flex column at least as tall as the viewport lets a widget fill the area
// (e.g. a tree with a pinned footer) while still growing and scrolling.
const verticalContentProps = { display: "flex", flexDirection: "column", minH: "100%", position: "relative" } as const;

// Horizontal header areas need a definite content height so full-height
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

export const resolveRenderedAreaPlacements = (
  widgets: WorkbenchWidgetPlacement[],
  activeWidgetId?: string,
): WorkbenchWidgetPlacement[] => {
  const activePlacement = getActivePlacement(widgets, activeWidgetId);
  if (!activePlacement) return [];
  return widgets.filter(
    (placement) => placement.widgetId === activePlacement.widgetId || placement.mountStrategy === "keep-mounted",
  );
};

export const resolveAreaPlacementRenderState = (
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

export const WorkbenchArea = (props: WorkbenchAreaProps) => {
  const { workbench, area, title, pointerEvents = "auto", transparent = false } = props;
  const areaState = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas[area]);
  const widgets = useWorkbenchStore(workbench.layout.store, (state) => state.widgets);
  const hasPrimaryResource = useWorkbenchStore(workbench.layout.store, (state) =>
    Boolean(getAnchorResource(workbench.layout.getFrame(), state.layout, "primary")),
  );
  const globalActiveWidgetId = useWorkbenchStore(workbench.layout.store, (state) => getActiveWidgetId(state.layout));
  const panelPlacements = listPanelTabPlacements(areaState?.widgets ?? [], widgets);
  const placements = area === "side" ? filterSidePanelPlacements(panelPlacements, hasPrimaryResource) : panelPlacements;
  const activePlacement = getActivePlacement(placements, areaState?.activeWidgetId);
  const placeholder = activePlacement ? undefined : workbench.layout.getPlaceholder(area);
  const placement = activePlacement ?? (placeholder ? createPlaceholderPlacement(placeholder) : undefined);
  const renderedPlacements = activePlacement ? resolveRenderedAreaPlacements(placements, activePlacement.widgetId) : [];

  if (!placement) return null;

  const scrollsHorizontally = horizontalScrollAreas.has(area);

  // Interacting with an area makes its active widget the globally-active one (so clicking
  // into the floating session sets it global-active) without touching the primary anchor,
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
      bg={transparent ? "transparent" : getWorkbenchAreaBackground(area)}
      overflow="hidden"
      pointerEvents={pointerEvents}
      aria-label={title ?? area}
      onPointerDown={activateOnInteract}
      onFocusCapture={activateOnInteract}
    >
      {/* The area owns scrolling: overflowing widget content scrolls here
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
        // Vertical areas host a flex column so a widget can fill the area
        // (e.g. a tree with a pinned footer) yet still grow and scroll.
        contentProps={scrollsHorizontally ? horizontalContentProps : verticalContentProps}
      >
        {placeholder ? (
          <WorkbenchWidgetHost workbench={workbench} placement={placement} widget={placeholder} />
        ) : (
          renderedPlacements.map((renderedPlacement) => {
            const renderState = resolveAreaPlacementRenderState(renderedPlacement, activePlacement?.widgetId);

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
