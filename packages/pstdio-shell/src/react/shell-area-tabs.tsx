import { Button, HStack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ShellArea as ShellAreaId, ShellCore } from "../core";

interface ShellAreaTabsProps {
  shell: ShellCore;
  area: ShellAreaId;
  refresh: () => void;
}

export const ShellAreaTabs = (props: ShellAreaTabsProps) => {
  const { shell, area, refresh } = props;
  const areaState = shell.layout.getLayout().areas[area];
  const placements = areaState.widgets;

  if (placements.length < 2) return null;

  const activeWidgetId = areaState.activeWidgetId ?? placements[0]?.widgetId;

  const activate = (widgetId: string) => {
    shell.layout.activateWidget(widgetId);
    refresh();
  };

  return (
    <ScrollArea
      flex="1"
      minW="0"
      h="full"
      showHorizontalScrollbar
      showVerticalScrollbar={false}
      contentProps={{ minW: "max-content" }}
      viewportProps={{ h: "full", style: { overflowY: "hidden" } }}
    >
      <HStack gap="2xs" h="full" px="xs" minW="full">
        {placements.map((placement) => (
          <Button
            key={placement.widgetId}
            size="2xs"
            variant={placement.widgetId === activeWidgetId ? "subtle" : "ghost"}
            colorPalette="gray"
            maxW="12rem"
            minW="0"
            px="xs"
            title={placement.title}
            onClick={() => activate(placement.widgetId)}
          >
            <Text as="span" truncate>
              {placement.title ?? placement.contributionId}
            </Text>
          </Button>
        ))}
      </HStack>
    </ScrollArea>
  );
};
