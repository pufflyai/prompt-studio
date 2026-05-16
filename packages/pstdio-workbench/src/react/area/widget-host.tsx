import { Box, Center } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { RegisteredWidgetContribution, WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchWidgetHostProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  widget?: RegisteredWidgetContribution;
}

const WorkbenchWidgetFallback = (props: { label: string }) => {
  const { label } = props;

  return (
    <Center h="full" w="full" color="fg.muted" p="md" aria-label={label}>
      <WorkbenchIcon name="circle-alert" size={20} />
    </Center>
  );
};

const WorkbenchRenderedWidgetFrame = (props: { children: ReactNode }) => {
  const { children } = props;

  return (
    <Box flex="1" minW="0" minH="0" w="full" h="full" overflow="hidden">
      {children}
    </Box>
  );
};

const noopRefresh = () => undefined;

export const WorkbenchWidgetHost = (props: WorkbenchWidgetHostProps) => {
  const { workbench, placement } = props;
  const widget = props.widget ?? workbench.layout.getWidget(placement.contributionId);
  const refresh = noopRefresh;
  const renderer = useWorkbenchStore(workbench.renderers.store, (state) => state.renderers[widget?.rendererId ?? ""]);

  if (!widget) {
    return <WorkbenchWidgetFallback label="Widget contribution is no longer registered." />;
  }

  return (
    <Box display="flex" minW="0" minH="0" w="full" h="full" overflow="hidden">
      {renderer ? (
        <WorkbenchRenderedWidgetFrame>
          {renderer.render({ workbench, widget, placement, refresh }) as ReactNode}
        </WorkbenchRenderedWidgetFrame>
      ) : (
        <WorkbenchWidgetFallback label={`No renderer registered for ${widget.rendererId}.`} />
      )}
    </Box>
  );
};
