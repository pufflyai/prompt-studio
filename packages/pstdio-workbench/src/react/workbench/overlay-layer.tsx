import { Center, CloseButton } from "@chakra-ui/react";
import { ScopedDialog as Dialog, Portal } from "@pstdio/ui";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getWorkbenchRenderers, type WorkbenchCore, type WorkbenchWidgetPlacement } from "../../core";
import { toPanelContribution, toPanelInstance } from "../../core/registries/layout/panel-api";
import { settingsLeaveGuard } from "../settings/settings-leave-guard";
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

/** Restored placements wait for a live owner, without hiding a registered dialog behind them. */
export const resolveActiveOverlayPlacement = (
  placements: WorkbenchWidgetPlacement[],
  activeWidgetId: string | undefined,
  registered: Readonly<Record<string, unknown>>,
) => {
  const eligible = placements.filter((placement) => Boolean(registered[placement.contributionId]));
  return eligible.find((entry) => entry.widgetId === activeWidgetId) ?? eligible[0];
};

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
  const widgets = useWorkbenchStore(workbench.layout.store, (state) => state.widgets);
  const renderers = useWorkbenchStore(getWorkbenchRenderers(workbench).store, (state) => state.renderers);
  useWorkbenchStore(getWorkbenchRenderers(workbench).store, (state) => state.refreshKeys);
  const [exitingPlacement, setExitingPlacement] = useState<WorkbenchWidgetPlacement | undefined>();
  const contentRef = useRef<HTMLDivElement>(null);

  const activePlacement = resolveActiveOverlayPlacement(overlayRegion.widgets, overlayRegion.activeWidgetId, widgets);
  const renderState = resolveOverlayDialogRenderState(activePlacement, exitingPlacement);
  const exitingWidgetId = activePlacement ? undefined : exitingPlacement?.widgetId;

  useEffect(() => {
    if (activePlacement) setExitingPlacement(undefined);
  }, [activePlacement]);

  useLayoutEffect(() => {
    if (!exitingWidgetId) return;
    let active = true;
    // A finished CSS animation can precede a presence listener in WebKit. Its
    // completion promise also handles cancellation and already-finished exits.
    const animations = contentRef.current?.getAnimations() ?? [];
    void Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(() => {
      if (active) setExitingPlacement((current) => (current?.widgetId === exitingWidgetId ? undefined : current));
    });
    return () => {
      active = false;
    };
  }, [exitingWidgetId]);

  if (!renderState) return null;

  const { open, placement } = renderState;
  const widget = widgets[placement.contributionId];
  if (!widget) return null;
  const overlayConfig = resolveOverlayDialogConfig(placement, widget?.config);
  const { contentHeight, contentMaxHeight, contentMinHeight, contentWidth, contentMaxWidth, ...dialogRootConfig } =
    overlayConfig;
  const renderer = widget ? renderers[widget.rendererId] : undefined;
  const canCloseOverlay = open && placement.closable === true;
  const closeLabel = placement.title ?? widget?.title ?? "overlay";

  const body = renderer ? (
    (renderer.render({
      workbench,
      panel: toPanelContribution(widget),
      instance: toPanelInstance(placement),
      refresh: () => undefined,
    }) as ReactNode)
  ) : (
    <WorkbenchOverlayFallback label={`No renderer registered for ${widget.rendererId}.`} />
  );

  const handleOpenChange = async (details: { open: boolean }) => {
    if (!details.open && canCloseOverlay) {
      if (placement.viewId === "workbench.settings" && !(await settingsLeaveGuard(workbench).request())) return;
      setExitingPlacement(placement);
      workbench.layout.closePanel(placement.widgetId);
    }
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
            ref={contentRef}
            aria-label={closeLabel}
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
              <Dialog.CloseTrigger asChild>
                <CloseButton position="absolute" top="2" right="2" size="sm" aria-label={`Close ${closeLabel}`} />
              </Dialog.CloseTrigger>
            ) : null}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
