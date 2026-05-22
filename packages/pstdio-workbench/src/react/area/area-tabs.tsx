import { Box, CloseButton, Tabs, Text } from "@chakra-ui/react";
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

  if (!shouldShowAreaTabs(placements)) return null;

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
      w="max-content"
      maxW="full"
      minW="0"
      h="full"
      display="flex"
    >
      <Box
        h="full"
        minW="0"
        w="full"
        overflowX="auto"
        overflowY="hidden"
        css={{
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
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
                position="relative"
                zIndex={isActive ? "1" : undefined}
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
      </Box>
    </Tabs.Root>
  );
};
