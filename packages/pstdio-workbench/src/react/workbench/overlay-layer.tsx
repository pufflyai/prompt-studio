import { Center, Dialog, Portal } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export interface WorkbenchOverlayWidgetConfig {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "cover" | "full";
  placement?: "center" | "top" | "bottom";
  scrollBehavior?: "inside" | "outside";
  closeOnEscape?: boolean;
  closeOnInteractOutside?: boolean;
  motionPreset?: "scale" | "slide-in-bottom" | "slide-in-top" | "slide-in-left" | "slide-in-right" | "none";
  role?: "dialog" | "alertdialog";
}

const resolveOverlayConfig = (config: unknown): WorkbenchOverlayWidgetConfig =>
  config && typeof config === "object" ? (config as WorkbenchOverlayWidgetConfig) : {};

export const resolveOverlayDialogConfig = (placement: Pick<WorkbenchWidgetPlacement, "closable">, config: unknown) => {
  const closeable = placement.closable === true;
  const overlayConfig = resolveOverlayConfig(config);

  return {
    ...overlayConfig,
    closeOnEscape: closeable && (overlayConfig.closeOnEscape ?? true),
    closeOnInteractOutside: closeable && (overlayConfig.closeOnInteractOutside ?? true),
  };
};

const resolveActivePlacement = (widgets: WorkbenchWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((entry) => entry.widgetId === activeWidgetId) ?? widgets[0];

export const resolveOverlayDialogRenderState = (
  activePlacement: WorkbenchWidgetPlacement | undefined,
  exitingPlacement: WorkbenchWidgetPlacement | undefined,
) => {
  if (activePlacement) return { open: true, placement: activePlacement };
  if (exitingPlacement) return { open: false, placement: exitingPlacement };
  return undefined;
};

const WorkbenchOverlayFallback = (props: { label: string }) => (
  <Center h="full" w="full" color="fg.muted" p="md" aria-label={props.label}>
    <WorkbenchIcon name="circle-alert" size={20} />
  </Center>
);

interface WorkbenchOverlayLayerProps {
  workbench: WorkbenchCore;
}

export const WorkbenchOverlayLayer = (props: WorkbenchOverlayLayerProps) => {
  const { workbench } = props;
  const overlayArea = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas.overlay);
  const renderers = useWorkbenchStore(workbench.renderers.store, (state) => state.renderers);
  const [exitingPlacement, setExitingPlacement] = useState<WorkbenchWidgetPlacement | undefined>();

  const activePlacement = resolveActivePlacement(overlayArea.widgets, overlayArea.activeWidgetId);
  const renderState = resolveOverlayDialogRenderState(activePlacement, exitingPlacement);

  useEffect(() => {
    if (activePlacement) setExitingPlacement(undefined);
  }, [activePlacement]);

  if (!renderState) return null;

  const { open, placement } = renderState;
  const widget = workbench.layout.getWidget(placement.contributionId);
  const overlayConfig = resolveOverlayDialogConfig(placement, widget?.config);
  const renderer = widget ? renderers[widget.rendererId] : undefined;
  const canCloseOverlay = open && placement.closable === true;
  const closeLabel = placement.title ?? widget?.title ?? "overlay";

  // Overlay widgets are full-screen dialogs — keep-alive doesn't apply here.
  // Reject keep-alive renderers explicitly so the misconfiguration surfaces
  // instead of silently rendering nothing into the dialog.
  if (widget && renderer?.keepAlive) {
    throw new Error(
      `Widget ${widget.id} uses keep-alive renderer ${renderer.id} in the overlay area; overlay widgets cannot reuse keep-alive hosts.`,
    );
  }

  const body =
    widget && renderer ? (
      (renderer.render({ workbench, widget, placement, refresh: () => undefined }) as ReactNode)
    ) : (
      <WorkbenchOverlayFallback
        label={
          widget ? `No renderer registered for ${widget.rendererId}.` : "Widget contribution is no longer registered."
        }
      />
    );

  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open && canCloseOverlay) {
      setExitingPlacement(placement);
      workbench.layout.closeWidget(placement.widgetId);
    }
  };

  const handleExitComplete = () => {
    setExitingPlacement((current) => (current?.widgetId === placement.widgetId ? undefined : current));
  };

  return (
    <Dialog.Root {...overlayConfig} open={open} onExitComplete={handleExitComplete} onOpenChange={handleOpenChange}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content position="relative">
            {body}
            {canCloseOverlay ? (
              <Dialog.CloseTrigger
                aria-label={`Close ${closeLabel}`}
                alignItems="center"
                borderRadius="sm"
                color="fg.muted"
                display="inline-flex"
                h="8"
                insetEnd="2"
                justifyContent="center"
                position="absolute"
                top="2"
                w="8"
                zIndex="1"
                _hover={{ bg: "bg.subtle", color: "fg" }}
              >
                <WorkbenchIcon name="x" size={16} />
              </Dialog.CloseTrigger>
            ) : null}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
