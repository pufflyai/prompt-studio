import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import {
  AttachedPanel,
  BubblePanel,
  Header,
  PANEL_HEADER_CONTROL_SIZE,
  ResourceContextMenu,
  Tooltip,
} from "@pstdio/ui";
import { Minimize2, Minus, SquareArrowOutUpRight } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import type { WorkbenchCore } from "../../core";
import { sidePanelBubblePreferences } from "../../core/controllers/side-panel/side-panel-bubble";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { PanelHeader } from "../region/panel-header";
import { WorkbenchTabDropTarget } from "../region/tab-drag-context";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { FloatingSidePanelResizeHandles } from "./floating-side-panel-resize-handles";
import { SidePanelBubble } from "./side-panel-bubble";
import { SidePanelDropTargets } from "./side-panel-drop-targets";
import { useFloatingSidePanel } from "./use-floating-side-panel";

interface WorkbenchSidePanelProps {
  workbench: WorkbenchCore;
  contentSlotRef: (node: HTMLDivElement | null) => void;
  bottomOffset?: string;
  header?: ReactNode;
  bubbleIcon?: ReactNode;
  onOpen?: () => void | Promise<void>;
}

const floatingPanelBottom = (bottomOffset: string | undefined) =>
  bottomOffset ? `calc(${bottomOffset} + 0.75rem)` : "0.75rem";

const launcherBottom = (bottomOffset: string | undefined) => (bottomOffset ? `calc(${bottomOffset} + 1.5rem)` : "6");

const WorkbenchSidePanelTitle = () => (
  <Box flex="1" minW="0">
    <Text textStyle="label/S/medium" color="fg" truncate>
      Side Panel
    </Text>
  </Box>
);

interface WorkbenchSidePanelHeaderProps {
  header?: ReactNode;
}

const WorkbenchSidePanelHeader = (props: WorkbenchSidePanelHeaderProps) => {
  const { header } = props;

  return header ?? <WorkbenchSidePanelTitle />;
};

export const WorkbenchAttachedSidePanel = (props: WorkbenchSidePanelProps) => {
  const { workbench, contentSlotRef, header } = props;
  const canFloat = useWorkbenchStore(workbench.modes.store, () => workbench.sidePanel.canFloat());
  const mode = useWorkbenchStore(workbench.layout.store, () => workbench.sidePanel.getMode());
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  const attached = mode === "attached" && !fullscreen;

  return (
    <WorkbenchFocusRegion workbench={workbench} region="side" h="full" minH="0" minW="0" w="full">
      <AttachedPanel
        data-testid="workbench-side-panel-attached"
        data-workbench-panel="side"
        data-workbench-region="side"
        width="full"
        minWidth="0"
        bg={workbenchBackgrounds.main}
        layerStyle="panel"
        header={
          attached ? (
            <PanelHeader workbench={workbench} region="side" variant="main" flexShrink={0} gap="sm">
              <WorkbenchSidePanelHeader header={header} />
              <WorkbenchPanelMenuOpeners workbench={workbench} panel="side" />
              {canFloat ? (
                <Tooltip content="Float Side Panel">
                  <IconButton
                    size={PANEL_HEADER_CONTROL_SIZE}
                    variant="ghost"
                    aria-label="Float Side Panel"
                    onClick={() => workbench.shell.setSidePanelPresentation("floating")}
                  >
                    <Minimize2 size={16} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </PanelHeader>
          ) : undefined
        }
      >
        <Flex position="relative" flex="1" minH={0} direction="column">
          <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
        </Flex>
        <WorkbenchTabDropTarget region="side" visible={attached} />
      </AttachedPanel>
    </WorkbenchFocusRegion>
  );
};

interface WorkbenchFloatingSidePanelProps extends WorkbenchSidePanelProps {
  available?: boolean;
}

export const useSidePanelLauncherVisible = (workbench: WorkbenchCore, available: boolean) => {
  const mode = useWorkbenchStore(workbench.layout.store, () => workbench.sidePanel.getMode());
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state);
  const canFloat = useWorkbenchStore(workbench.modes.store, () => workbench.sidePanel.canFloat());
  const policy = usePanelPolicy(workbench, "side");
  const enabled = useWorkbenchStore(
    workbench.preferences.store,
    () => workbench.preferences.getValue(sidePanelBubblePreferences.visible) !== false,
  );
  return (
    enabled && available && canFloat && policy.canOpen && (fullscreen.active ? !fullscreen.sideOpen : mode === "closed")
  );
};

export const WorkbenchFloatingSidePanel = (props: WorkbenchFloatingSidePanelProps) => {
  const { workbench, contentSlotRef, bottomOffset, header, bubbleIcon, onOpen, available = true } = props;
  const mode = useWorkbenchStore(workbench.layout.store, () => workbench.sidePanel.getMode());
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state);
  const canFloat = useWorkbenchStore(workbench.modes.store, () => workbench.sidePanel.canFloat());
  const policy = usePanelPolicy(workbench, "side");
  const visible = available && canFloat && (fullscreen.active ? fullscreen.sideOpen : mode === "floating");
  const launcherVisible = useSidePanelLauncherVisible(workbench, available);
  const panelRef = useRef<HTMLDivElement>(null);
  const position = useFloatingSidePanel({
    workbench,
    panelRef,
    visible,
    resizable: policy.resizable,
    bottom: floatingPanelBottom(bottomOffset),
  });
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const previousFullscreen = useRef(fullscreen);
  useLayoutEffect(() => {
    const previous = previousFullscreen.current;
    previousFullscreen.current = fullscreen;
    if (!previous.active || !fullscreen.active || !previous.sideOpen || fullscreen.sideOpen) return;
    const frame = requestAnimationFrame(() => {
      if (bubbleRef.current) bubbleRef.current.focus({ preventScroll: true });
      else workbench.focus.setActiveRegion("main");
    });
    return () => cancelAnimationFrame(frame);
  }, [fullscreen, workbench]);

  return (
    <>
      {launcherVisible || visible ? (
        <SidePanelBubble
          workbench={workbench}
          buttonRef={bubbleRef}
          isOpen={visible}
          bottom={launcherBottom(bottomOffset)}
          bottomOffset={bottomOffset}
          icon={bubbleIcon}
          onOpen={onOpen}
        />
      ) : null}
      <SidePanelDropTargets alignment={position.dropAlignment} bottom={bottomOffset} />
      {/* Both presentation slots stay connected so hiding cannot release a live iframe. */}
      <BubblePanel
        ref={panelRef}
        isOpen={visible}
        aria-label="Side Panel"
        testId="workbench-side-panel-floating"
        closeLabel="Close Side Panel"
        containerProps={{
          bottom: floatingPanelBottom(bottomOffset),
          ...position.frameProps,
          "data-workbench-panel": "side",
          bg: workbenchBackgrounds.main,
        }}
        popOutLabel="Reattach Side Panel"
        header={
          visible && policy.showHeader ? (
            <ResourceContextMenu actions={position.actions}>
              <Header
                variant="main"
                gap="sm"
                aria-label="Side panel header"
                aria-keyshortcuts="Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
                data-workbench-panel-header="side"
                tabIndex={0}
                {...position.dragProps}
                onPointerDown={(event) => {
                  const target = event.target as Element;
                  if (
                    target.closest(
                      'button,a,input,textarea,select,[role="tab"],[role="button"],[contenteditable="true"]',
                    )
                  )
                    return;
                  position.dragProps.onPointerDown(event);
                }}
              >
                <WorkbenchSidePanelHeader header={header} />
                <WorkbenchPanelMenuOpeners workbench={workbench} panel="side" />
                {!fullscreen.active ? (
                  <Tooltip content="Reattach Side Panel">
                    <IconButton
                      size={PANEL_HEADER_CONTROL_SIZE}
                      variant="ghost"
                      aria-label="Reattach Side Panel"
                      onClick={() => workbench.shell.setSidePanelPresentation("attached")}
                    >
                      <SquareArrowOutUpRight size={16} />
                    </IconButton>
                  </Tooltip>
                ) : null}
                {policy.canClose ? (
                  <Tooltip content="Close Side Panel">
                    <IconButton
                      size={PANEL_HEADER_CONTROL_SIZE}
                      variant="ghost"
                      aria-label="Close Side Panel"
                      onClick={() =>
                        fullscreen.active
                          ? workbench.fullscreen.hideSide()
                          : workbench.shell.setRegionOpen("side", false)
                      }
                    >
                      <Minus size={16} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Header>
            </ResourceContextMenu>
          ) : null
        }
        onPopOut={() => workbench.sidePanel.setMode("attached")}
        menu={visible ? <WorkbenchSidePanelHeader header={header} /> : undefined}
        overlay={
          <>
            <WorkbenchTabDropTarget region="side" visible={visible} />
            {visible && policy.resizable ? <FloatingSidePanelResizeHandles resizeProps={position.resizeProps} /> : null}
          </>
        }
      >
        <WorkbenchFocusRegion workbench={workbench} region="side" display="flex" flex="1" minH="0">
          <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
        </WorkbenchFocusRegion>
      </BubblePanel>
    </>
  );
};
