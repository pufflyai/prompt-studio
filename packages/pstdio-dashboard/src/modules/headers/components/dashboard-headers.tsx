import { Box, HStack, IconButton } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import type { WorkbenchWidgetPlacement } from "@pstdio/workbench/core";
import type { WorkbenchWidgetRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore, WorkbenchBreadcrumbView } from "@pstdio/workbench/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { renderMainHeaderContribution } from "@/shared/workbench/contributions/header-contributions";

const getActivePlacement = (widgets: WorkbenchWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

const NavigationHistoryControls = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const history = useWorkbenchStore(input.workbench.history.store, (state) => state);
  const canNavigateBack = history.cursor > 0;
  const canNavigateForward = history.cursor >= 0 && history.cursor < history.entries.length - 1;

  return (
    <HStack gap="2xs" flexShrink={0}>
      <Tooltip content="Navigate back">
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="Navigate back"
          disabled={!canNavigateBack}
          onClick={() => input.workbench.history.goBack()}
        >
          <ArrowLeft size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip content="Navigate forward">
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="Navigate forward"
          disabled={!canNavigateForward}
          onClick={() => input.workbench.history.goForward()}
        >
          <ArrowRight size={14} />
        </IconButton>
      </Tooltip>
    </HStack>
  );
};

export const DashboardMainHeader = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const mainArea = useWorkbenchStore(input.workbench.layout.store, (state) => state.layout.areas.main);
  const activePlacement = getActivePlacement(mainArea.widgets, mainArea.activeWidgetId);

  if (!activePlacement) return null;

  return (
    <HStack h="full" w="full" minW="0" gap="sm">
      <NavigationHistoryControls input={input} />
      <WorkbenchBreadcrumbView workbench={input.workbench} />
      <Box flex="1" minW="0" />
      {renderMainHeaderContribution(input, activePlacement)}
    </HStack>
  );
};
