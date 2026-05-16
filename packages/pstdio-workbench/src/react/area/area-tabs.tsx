import { Box, CloseButton, Tabs, Text } from "@chakra-ui/react";
import type { WorkbenchArea as WorkbenchAreaId, WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

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

  return (
    <Tabs.Root
      value={activeWidgetId}
      onValueChange={(details) => workbench.layout.activateWidget(details.value)}
      variant="subtle"
      colorPalette="gray"
      justify="start"
      size="sm"
      alignSelf="center"
      flex="0 1 auto"
      w="max-content"
      maxW="full"
      minW="0"
      h="1.75rem"
      display="flex"
      overflow="hidden"
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
        <Tabs.List h="full" minW="max-content" alignItems="center" justifyContent="flex-start">
          {placements.map((placement) => {
            const closable = isPlacementCloseable(placement);
            const isActive = placement.widgetId === activeWidgetId;
            const label = placement.title ?? placement.contributionId;

            return (
              <Tabs.Trigger
                key={placement.widgetId}
                value={placement.widgetId}
                h="1.5rem"
                maxW="12rem"
                minW="0"
                flexShrink={0}
                gap="2xs"
                px="xs"
                py="0"
                textStyle="label/XS/medium"
                title={label}
                className="group"
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
