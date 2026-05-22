import { CloseButton, Tabs, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { WorkbenchArea as WorkbenchAreaId, WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getWorkbenchAreaBackground } from "../theme/workbench-theme-background";

interface WorkbenchAreaTabsProps {
  workbench: WorkbenchCore;
  area: WorkbenchAreaId;
}

const isPlacementCloseable = (placement: WorkbenchWidgetPlacement) => placement.closable === true;

export const shouldShowAreaTabs = (placements: WorkbenchWidgetPlacement[]) =>
  placements.length > 1 || placements.some(isPlacementCloseable);

export const WorkbenchAreaTabs = (props: WorkbenchAreaTabsProps) => {
  const { workbench, area } = props;
  const areaState = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas[area]);
  const placements = areaState.widgets;
  const showTabs = shouldShowAreaTabs(placements);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);

  // Translate vertical wheel into horizontal scrolling so the tab strip scrolls
  // with a plain mouse wheel — no modifier key required.
  useEffect(() => {
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0 || viewport.scrollWidth <= viewport.clientWidth) return;
      viewport.scrollLeft += event.deltaY;
      event.preventDefault();
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [viewport]);

  if (!showTabs) return null;

  const activeWidgetId = areaState.activeWidgetId ?? placements[0]?.widgetId;
  // The active tab paints over the header's bottom line, so it has to match the
  // panel content background to read as a seamless connection.
  const activeBackground = getWorkbenchAreaBackground(area);

  return (
    <Tabs.Root
      value={activeWidgetId}
      onValueChange={(details) => workbench.layout.activateWidget(details.value)}
      variant="outline"
      colorPalette="gray"
      justify="start"
      size="sm"
      alignSelf="stretch"
      flex="0 1 auto"
      maxW="full"
      minW="0"
      h="full"
      position="relative"
      zIndex="1"
    >
      {/* Overflowing tabs scroll horizontally; the overlay scrollbar adds no
          height so the active tab still meets the header's bottom edge. */}
      <ScrollArea
        viewportRef={setViewport}
        size="xs"
        h="full"
        w="max-content"
        maxW="full"
        minW="0"
        showVerticalScrollbar={false}
        showHorizontalScrollbar
        contentProps={{ h: "full" }}
      >
        <Tabs.List h="full" minW="max-content" alignItems="stretch" justifyContent="flex-start">
          {placements.map((placement) => {
            const closable = isPlacementCloseable(placement);
            const isActive = placement.widgetId === activeWidgetId;
            const label = placement.title ?? placement.contributionId;

            return (
              <Tabs.Trigger
                key={placement.widgetId}
                value={placement.widgetId}
                h="full"
                maxW="12rem"
                minW="0"
                flexShrink={0}
                gap="2xs"
                px="sm"
                py="0"
                textStyle="label/XS/medium"
                title={label}
                className="group"
                _selected={{ bg: activeBackground }}
                _hover={isActive ? undefined : { bg: "bg.hover", color: "fg" }}
              >
                <Text as="span" minW="0" truncate>
                  {label}
                </Text>
                {closable ? (
                  <CloseButton
                    as="span"
                    role="button"
                    aria-label={`Close ${label}`}
                    size="2xs"
                    flexShrink={0}
                    me="-2"
                    opacity={isActive ? "1" : "0"}
                    pointerEvents={isActive ? "auto" : "none"}
                    _groupHover={{ opacity: "1", pointerEvents: "auto" }}
                    _groupFocusWithin={{ opacity: "1", pointerEvents: "auto" }}
                    transition="opacity 120ms ease"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      workbench.layout.closeWidget(placement.widgetId);
                    }}
                  />
                ) : null}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
      </ScrollArea>
    </Tabs.Root>
  );
};
