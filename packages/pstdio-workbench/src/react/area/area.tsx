import { Box, Flex } from "@chakra-ui/react";
import type {
  RegisteredAreaPlaceholderContribution,
  WorkbenchArea as WorkbenchAreaId,
  WorkbenchCore,
  WorkbenchWidgetPlacement,
} from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getWorkbenchAreaBackground } from "../theme/workbench-theme-background";
import { WorkbenchWidgetHost } from "./widget-host";

interface WorkbenchAreaProps {
  workbench: WorkbenchCore;
  area: WorkbenchAreaId;
  title?: string;
  showHeader?: boolean;
  hideSingleTabHeader?: boolean;
  pointerEvents?: "auto" | "none";
  transparent?: boolean;
}

const getActivePlacement = (widgets: WorkbenchWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

const createPlaceholderPlacement = (placeholder: RegisteredAreaPlaceholderContribution): WorkbenchWidgetPlacement => ({
  widgetId: placeholder.id,
  contributionId: placeholder.id,
  title: placeholder.title,
  closable: false,
});

export const WorkbenchArea = (props: WorkbenchAreaProps) => {
  const { workbench, area, title, pointerEvents = "auto", transparent = false } = props;
  const areaState = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas[area]);
  const activePlacement = getActivePlacement(areaState.widgets, areaState.activeWidgetId);
  const placeholder = activePlacement ? undefined : workbench.layout.getAreaPlaceholder(area);
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
      bg={transparent ? "transparent" : getWorkbenchAreaBackground(area)}
      overflow="hidden"
      pointerEvents={pointerEvents}
      aria-label={title ?? area}
    >
      <Box flex="1" h="full" minH="0" minW="0" w="full" overflow="hidden">
        <WorkbenchWidgetHost workbench={workbench} placement={placement} widget={placeholder} />
      </Box>
    </Flex>
  );
};
