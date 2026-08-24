import { Center, Dialog, Portal } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { toPanelContribution, toPanelInstance } from "../../core/registries/layout/panel-api";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export interface WorkbenchOverlayWidgetConfig {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "cover" | "full";
  placement?: "center" | "top" | "bottom";
  scrollBehavior?: "inside" | "outside";
  closeOnEscape?: boolean;
  closeOnInteractOutside?: boolean;
  /** Controls dialog semantics. Every workbench overlay blocks background pointer input. */
  modal?: boolean;
  preventScroll?: boolean;
  trapFocus?: boolean;
  motionPreset?: "scale" | "slide-in-bottom" | "slide-in-top" | "slide-in-left" | "slide-in-right" | "none";
  role?: "dialog" | "alertdialog";
  contentHeight?: string;
  contentMaxHeight?: string;
  contentMinHeight?: string;
  contentWidth?: string;
  contentMaxWidth?: string;
  closeTriggerTop?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

const booleanValue = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
};

const resolveOverlayConfig = (config: unknown): WorkbenchOverlayWidgetConfig => {
  if (!isRecord(config)) return {};

  const overlayConfig: WorkbenchOverlayWidgetConfig = {};
  const size = stringValue(config, "size");
  const placement = stringValue(config, "placement");
  const scrollBehavior = stringValue(config, "scrollBehavior");
  const closeOnEscape = booleanValue(config, "closeOnEscape");
  const closeOnInteractOutside = booleanValue(config, "closeOnInteractOutside");
  const modal = booleanValue(config, "modal");
  const preventScroll = booleanValue(config, "preventScroll");
  const trapFocus = booleanValue(config, "trapFocus");
  const motionPreset = stringValue(config, "motionPreset");
  const role = stringValue(config, "role");
  const contentHeight = stringValue(config, "contentHeight");
  const contentMaxHeight = stringValue(config, "contentMaxHeight");
  const contentMinHeight = stringValue(config, "contentMinHeight");
  const contentWidth = stringValue(config, "contentWidth");
  const contentMaxWidth = stringValue(config, "contentMaxWidth");
  const closeTriggerTop = stringValue(config, "closeTriggerTop");

  if (size) overlayConfig.size = size as WorkbenchOverlayWidgetConfig["size"];
  if (placement) overlayConfig.placement = placement as WorkbenchOverlayWidgetConfig["placement"];
  if (scrollBehavior) overlayConfig.scrollBehavior = scrollBehavior as WorkbenchOverlayWidgetConfig["scrollBehavior"];
  if (closeOnEscape !== undefined) overlayConfig.closeOnEscape = closeOnEscape;
  if (closeOnInteractOutside !== undefined) overlayConfig.closeOnInteractOutside = closeOnInteractOutside;
  if (modal !== undefined) overlayConfig.modal = modal;
  if (preventScroll !== undefined) overlayConfig.preventScroll = preventScroll;
  if (trapFocus !== undefined) overlayConfig.trapFocus = trapFocus;
  if (motionPreset) overlayConfig.motionPreset = motionPreset as WorkbenchOverlayWidgetConfig["motionPreset"];
  if (role) overlayConfig.role = role as WorkbenchOverlayWidgetConfig["role"];
  if (contentHeight) overlayConfig.contentHeight = contentHeight;
  if (contentMaxHeight) overlayConfig.contentMaxHeight = contentMaxHeight;
  if (contentMinHeight) overlayConfig.contentMinHeight = contentMinHeight;
  if (contentWidth) overlayConfig.contentWidth = contentWidth;
  if (contentMaxWidth) overlayConfig.contentMaxWidth = contentMaxWidth;
  if (closeTriggerTop) overlayConfig.closeTriggerTop = closeTriggerTop;
  return overlayConfig;
};

export const resolveOverlayDialogConfig = (placement: Pick<WorkbenchWidgetPlacement, "closable">, config: unknown) => {
  const closeable = placement.closable === true;
  const overlayConfig = resolveOverlayConfig(config);

  return {
    size: "xl",
    scrollBehavior: "inside",
    modal: true,
    preventScroll: true,
    trapFocus: true,
    ...overlayConfig,
    closeOnEscape: closeable && (overlayConfig.closeOnEscape ?? true),
    closeOnInteractOutside: closeable && (overlayConfig.closeOnInteractOutside ?? true),
  } satisfies WorkbenchOverlayWidgetConfig;
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
  const overlayRegion = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.overlay);
  const renderers = useWorkbenchStore(workbench.renderers.store, (state) => state.renderers);
  const [exitingPlacement, setExitingPlacement] = useState<WorkbenchWidgetPlacement | undefined>();

  const activePlacement = resolveActivePlacement(overlayRegion.widgets, overlayRegion.activeWidgetId);
  const renderState = resolveOverlayDialogRenderState(activePlacement, exitingPlacement);

  useEffect(() => {
    if (activePlacement) setExitingPlacement(undefined);
  }, [activePlacement]);

  if (!renderState) return null;

  const { open, placement } = renderState;
  const widget = workbench.layout.getWidget(placement.contributionId);
  const overlayConfig = resolveOverlayDialogConfig(placement, widget?.config);
  const {
    contentHeight,
    contentMaxHeight,
    contentMinHeight,
    contentWidth,
    contentMaxWidth,
    closeTriggerTop,
    ...dialogRootConfig
  } = overlayConfig;
  const renderer = widget ? renderers[widget.rendererId] : undefined;
  const canCloseOverlay = open && placement.closable === true;
  const closeLabel = placement.title ?? widget?.title ?? "overlay";

  // Overlay widgets are full-screen dialogs — keep-alive doesn't apply here.
  // Reject keep-alive renderers explicitly so the misconfiguration surfaces
  // instead of silently rendering nothing into the dialog.
  if (widget && renderer?.keepAlive) {
    throw new Error(
      `Widget ${widget.id} uses keep-alive renderer ${renderer.id} in the overlay region; overlay widgets cannot reuse keep-alive hosts.`,
    );
  }

  const body =
    widget && renderer ? (
      (renderer.render({
        workbench,
        panel: toPanelContribution(widget),
        instance: toPanelInstance(placement),
        refresh: () => undefined,
      }) as ReactNode)
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
      workbench.layout.closePanel(placement.widgetId);
    }
  };

  const handleExitComplete = () => {
    setExitingPlacement((current) => (current?.widgetId === placement.widgetId ? undefined : current));
  };

  // Nested overlays (confirmation dialogs, popovers, menus) portal outside this
  // dialog's content, so their clicks register as outside interactions here. If
  // the interaction landed inside any overlay content, it cannot mean "dismiss
  // the settings dialog" — the widget's own content never reaches this handler.
  const handleInteractOutside = (event: CustomEvent<{ originalEvent?: Event }>) => {
    const target = event.detail.originalEvent?.target;
    if (target instanceof Element && target.closest('[data-part="content"]')) {
      event.preventDefault();
    }
  };

  return (
    <Dialog.Root
      {...dialogRootConfig}
      open={open}
      onExitComplete={handleExitComplete}
      onOpenChange={handleOpenChange}
      onInteractOutside={handleInteractOutside}
    >
      <Portal>
        <Dialog.Backdrop position="fixed" inset="0" pointerEvents="auto" />
        <Dialog.Positioner
          position="fixed"
          inset="0"
          overflow={dialogRootConfig.scrollBehavior === "outside" ? "auto" : "hidden"}
          pointerEvents="auto"
        >
          <Dialog.Content
            position="relative"
            overflow="hidden"
            borderWidth="1px"
            borderColor="border.subtle"
            h={contentHeight}
            maxH={contentMaxHeight}
            minH={contentMinHeight}
            w={contentWidth}
            maxW={contentMaxWidth}
          >
            {body}
            {canCloseOverlay ? (
              <Dialog.CloseTrigger
                aria-label={`Close ${closeLabel}`}
                alignItems="center"
                borderRadius="sm"
                color="fg.muted"
                cursor="pointer"
                display="inline-flex"
                h="5"
                insetEnd="1"
                justifyContent="center"
                position="absolute"
                top={closeTriggerTop ?? "1"}
                w="5"
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
