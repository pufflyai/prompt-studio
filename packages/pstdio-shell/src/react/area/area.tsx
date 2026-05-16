import { Box, Flex } from "@chakra-ui/react";
import type {
  RegisteredAreaPlaceholderContribution,
  ShellArea as ShellAreaId,
  ShellCore,
  ShellWidgetPlacement,
} from "../../core";
import { useShellStore } from "../shared/use-shell-store";
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

const createPlaceholderPlacement = (placeholder: RegisteredAreaPlaceholderContribution): ShellWidgetPlacement => ({
  widgetId: placeholder.id,
  contributionId: placeholder.id,
  title: placeholder.title,
  closable: false,
});

export const ShellArea = (props: ShellAreaProps) => {
  const { shell, area, title, pointerEvents = "auto", transparent = false } = props;
  const areaState = useShellStore(shell.layout.store, (state) => state.layout.areas[area]);
  const activePlacement = getActivePlacement(areaState.widgets, areaState.activeWidgetId);
  const placeholder = activePlacement ? undefined : shell.layout.getAreaPlaceholder(area);
  const placement = activePlacement ?? (placeholder ? createPlaceholderPlacement(placeholder) : undefined);

  if (!placement) return null;

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
        <ShellWidgetHost shell={shell} placement={placement} widget={placeholder} />
      </Box>
    </Flex>
  );
};
