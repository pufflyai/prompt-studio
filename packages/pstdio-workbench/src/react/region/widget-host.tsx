import { Box, Center } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type {
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  RegisteredWorkbenchView,
  WorkbenchCore,
  WorkbenchPanelContribution,
  WorkbenchRegion,
  WorkbenchWidgetPlacement,
} from "../../core";
import { getWorkbenchRenderers } from "../../core";
import { toPanelContribution, toPanelInstance } from "../../core/registries/layout/panel-api";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchWidgetHostProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  widget?: RegisteredWidgetContribution | RegisteredPlaceholderContribution;
  region?: WorkbenchRegion;
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

const toHostedPanel = (input: {
  placement: WorkbenchWidgetPlacement;
  region?: WorkbenchRegion;
  view?: RegisteredWorkbenchView;
  widget?: RegisteredWidgetContribution | RegisteredPlaceholderContribution;
}) => {
  if (input.view) {
    return {
      id: input.placement.contributionId,
      title: input.placement.title ?? input.view.title,
      icon: input.view.icon,
      region: input.region ?? input.widget?.region ?? "main",
      rendererId: input.view.id,
    } satisfies WorkbenchPanelContribution;
  }
  if (input.widget) {
    if ("singleton" in input.widget) return toPanelContribution(input.widget as RegisteredWidgetContribution);
    return input.widget;
  }
  return undefined;
};

export const WorkbenchWidgetHost = (props: WorkbenchWidgetHostProps) => {
  const { workbench, placement } = props;
  const widget = props.widget ?? workbench.layout.getWidget(placement.contributionId);
  const view = placement.viewId ? workbench.views.getView(placement.viewId) : undefined;
  const rendererId = view?.id ?? widget?.rendererId ?? "";
  const refresh = noopRefresh;
  const rendererFromStore = useWorkbenchStore(
    getWorkbenchRenderers(workbench).store,
    (state) => state.renderers[rendererId],
  );
  const renderer = rendererFromStore ?? getWorkbenchRenderers(workbench).getRenderer(rendererId);
  useWorkbenchStore(getWorkbenchRenderers(workbench).store, (state) => state.refreshKeys[rendererId] ?? 0);

  if (!widget && !view) {
    return <WorkbenchWidgetFallback label="Widget contribution is no longer registered." />;
  }
  const panel = toHostedPanel({ placement, region: props.region, view, widget });
  if (!panel) return <WorkbenchWidgetFallback label="View contribution is no longer registered." />;
  const instance = toPanelInstance(placement);

  return (
    // `flex: 1 0 auto` lets the host fill its region when the widget is short and
    // grow past it when the widget is tall, so the region's ScrollArea can scroll.
    <Box display="flex" flex="1 0 auto" minW="0" minH="0" w="full" overflow="hidden">
      {renderer ? (
        <WorkbenchRenderedWidgetFrame>
          {renderer.render({ workbench, panel, instance, refresh }) as ReactNode}
        </WorkbenchRenderedWidgetFrame>
      ) : (
        <WorkbenchWidgetFallback label={`No renderer registered for ${rendererId}.`} />
      )}
    </Box>
  );
};
