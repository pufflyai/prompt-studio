import { Box, Tabs, Text } from "@chakra-ui/react";
import type { ShellArea as ShellAreaId, ShellCore } from "../../core";

interface ShellAreaTabsProps {
  shell: ShellCore;
  area: ShellAreaId;
}

export const ShellAreaTabs = (props: ShellAreaTabsProps) => {
  const { shell, area } = props;
  const areaState = shell.layout.getLayout().areas[area];
  const placements = areaState.widgets;

  if (placements.length < 2) return null;

  const activeWidgetId = areaState.activeWidgetId ?? placements[0]?.widgetId;

  return (
    <Tabs.Root
      value={activeWidgetId}
      onValueChange={(details) => shell.layout.activateWidget(details.value)}
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
          {placements.map((placement) => (
            <Tabs.Trigger
              key={placement.widgetId}
              value={placement.widgetId}
              flexShrink={0}
              h="1.5rem"
              maxW="12rem"
              minW="0"
              px="xs"
              py="0"
              textStyle="label/XS/medium"
              title={placement.title}
            >
              <Text as="span" truncate>
                {placement.title ?? placement.contributionId}
              </Text>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Box>
    </Tabs.Root>
  );
};
