import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { ArrowLeft } from "lucide-react";
import type { WorkbenchWidgetPlacement } from "pstdio-workbench/core";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useWorkbenchStore, WorkbenchBreadcrumbView } from "pstdio-workbench/react";
import { dashboardResources } from "@/shared/app/resources";
import {
  renderLeftHeaderContribution,
  renderMainHeaderContribution,
} from "@/shared/workbench/contributions/header-contributions";

const getActivePlacement = (widgets: WorkbenchWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

export const DashboardMainHeader = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const mainArea = useWorkbenchStore(input.workbench.layout.store, (state) => state.layout.areas.main);
  const activePlacement = getActivePlacement(mainArea.widgets, mainArea.activeWidgetId);

  if (!activePlacement) return null;

  return (
    <HStack h="full" w="full" minW="0" gap="sm">
      <WorkbenchBreadcrumbView workbench={input.workbench} />
      <Box flex="1" minW="0" />
      {renderMainHeaderContribution(input, activePlacement)}
    </HStack>
  );
};

const BackToProjectHeader = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Button
      variant="ghost"
      size="sm"
      width="full"
      justifyContent="flex-start"
      px="xs"
      onClick={() => {
        void input.workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });
      }}
    >
      <ArrowLeft size={14} />
      <Text textStyle="label/M/medium" truncate>
        Back to project
      </Text>
    </Button>
  );
};

export const DashboardLeftHeader = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const activeModeId = useWorkbenchStore(input.workbench.modes.store, (state) => state.activeModeId);

  if (activeModeId === "settings" || activeModeId === "sessions") {
    return <BackToProjectHeader input={input} />;
  }

  return renderLeftHeaderContribution(input);
};
