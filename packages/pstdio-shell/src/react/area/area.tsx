import { Box, Flex } from "@chakra-ui/react";
import type { ShellArea as ShellAreaId, ShellCore, ShellWidgetPlacement } from "../../core";
import { ShellWidgetHost } from "./widget-host";

interface ShellAreaProps {
  shell: ShellCore;
  area: ShellAreaId;
  title?: string;
  showHeader?: boolean;
  hideSingleTabHeader?: boolean;
  pointerEvents?: "auto" | "none";
  transparent?: boolean;
}

const getActivePlacement = (widgets: ShellWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

export const ShellArea = (props: ShellAreaProps) => {
  const { shell, area, title, pointerEvents = "auto", transparent = false } = props;
  const areaState = shell.layout.getLayout().areas[area];
  const activePlacement = getActivePlacement(areaState.widgets, areaState.activeWidgetId);

  if (!activePlacement) return null;

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
        <ShellWidgetHost shell={shell} placement={activePlacement} />
      </Box>
    </Flex>
  );
};
