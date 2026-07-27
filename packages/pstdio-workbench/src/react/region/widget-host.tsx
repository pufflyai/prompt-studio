import { Box, Center } from "@chakra-ui/react";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import type {
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  WorkbenchCore,
  WorkbenchPanelRenderInput,
  WorkbenchRendererRegistration,
  WorkbenchWidgetPlacement,
} from "../../core";
import { toPanelContribution, toPanelInstance } from "../../core/registries/layout/panel-api";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchWidgetHostProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  widget?: RegisteredWidgetContribution | RegisteredPlaceholderContribution;
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

interface WorkbenchKeepAliveSlotProps {
  workbench: WorkbenchCore;
  rendererId: string;
  workbenchInput: WorkbenchPanelRenderInput;
}

// Claims the renderer's persistent host into a stable slot div. The kept-alive
// subtree itself lives in `WorkbenchKeepAliveLayer`; this just opens the door
// for the host to be reparented into the widget's frame.
const WorkbenchKeepAliveSlot = (props: WorkbenchKeepAliveSlotProps) => {
  const { workbench, rendererId, workbenchInput } = props;
  const slotRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const disposable = workbench.renderers.claim(rendererId, slot, workbenchInput);
    return () => disposable.dispose();
  }, [workbench, rendererId, workbenchInput]);

  return <div ref={slotRef} style={{ display: "contents" }} data-workbench-keep-alive-slot={rendererId} />;
};

const noopRefresh = () => undefined;

const renderWidgetBody = (renderer: WorkbenchRendererRegistration, workbenchInput: WorkbenchPanelRenderInput) => {
  if (renderer.keepAlive) {
    return (
      <WorkbenchKeepAliveSlot
        workbench={workbenchInput.workbench}
        rendererId={renderer.id}
        workbenchInput={workbenchInput}
      />
    );
  }
  return renderer.render(workbenchInput) as ReactNode;
};

export const WorkbenchWidgetHost = (props: WorkbenchWidgetHostProps) => {
  const { workbench, placement } = props;
  const widget = props.widget ?? workbench.layout.getWidget(placement.contributionId);
  const refresh = noopRefresh;
  const renderer = useWorkbenchStore(workbench.renderers.store, (state) => state.renderers[widget?.rendererId ?? ""]);

  if (!widget) {
    return <WorkbenchWidgetFallback label="Widget contribution is no longer registered." />;
  }
  const panel = "role" in widget ? toPanelContribution(widget as RegisteredWidgetContribution) : widget;
  const instance = toPanelInstance(placement);

  return (
    // `flex: 1 0 auto` lets the host fill its region when the widget is short and
    // grow past it when the widget is tall, so the region's ScrollArea can scroll.
    <Box display="flex" flex="1 0 auto" minW="0" minH="0" w="full" overflow="hidden">
      {renderer ? (
        <WorkbenchRenderedWidgetFrame>
          {renderWidgetBody(renderer, { workbench, panel, instance, refresh })}
        </WorkbenchRenderedWidgetFrame>
      ) : (
        <WorkbenchWidgetFallback label={`No renderer registered for ${widget.rendererId}.`} />
      )}
    </Box>
  );
};
