import { Box, Flex } from "@chakra-ui/react";
import { EmptyState, ScrollArea } from "@pstdio/ui";
import type { ShellArea as ShellAreaId, ShellCore, ShellWidgetPlacement } from "../core";
import { ShellWidgetHost } from "./shell-widget-host";

interface ShellAreaProps {
  shell: ShellCore;
  area: ShellAreaId;
  title?: string;
  emptyTitle?: string;
  showHeader?: boolean;
  hideSingleTabHeader?: boolean;
  pointerEvents?: "auto" | "none";
  transparent?: boolean;
  refresh?: () => void;
}

const getActivePlacement = (widgets: ShellWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

export const ShellArea = (props: ShellAreaProps) => {
  const {
    shell,
    area,
    title,
    emptyTitle = "No widgets open",
    pointerEvents = "auto",
    transparent = false,
    refresh = () => undefined,
  } = props;
  const areaState = shell.layout.getLayout().areas[area];
  const activePlacement = getActivePlacement(areaState.widgets, areaState.activeWidgetId);

  return (
    <Flex
      as="section"
      direction="column"
      h="full"
      minH="0"
      minW="0"
      w="full"
      bg={transparent ? "transparent" : "bg"}
      overflow="hidden"
      pointerEvents={pointerEvents}
      aria-label={title ?? area}
    >
      <Box flex="1" h="full" minH="0" minW="0" w="full" overflow="hidden">
        {activePlacement ? (
          <ShellWidgetHost shell={shell} placement={activePlacement} refresh={refresh} />
        ) : (
          <ScrollArea height="100%">
            <EmptyState minH="100%" title={emptyTitle} />
          </ScrollArea>
        )}
      </Box>
    </Flex>
  );
};
