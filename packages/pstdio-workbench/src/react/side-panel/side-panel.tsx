import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { AttachedPanel, BubbleButton, BubblePanel, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { MessageCircle, Minimize2, Minus, SquareArrowOutUpRight } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { PanelHeader } from "../region/panel-header";
import { WorkbenchTabDropTarget } from "../region/tab-drag-context";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";

interface WorkbenchSidePanelProps {
  workbench: WorkbenchCore;
  contentSlotRef: (node: HTMLDivElement | null) => void;
  bottomOffset?: string;
  header?: ReactNode;
  bubbleIcon?: ReactNode;
  onOpen?: () => void;
}

const floatingPanelBottom = (bottomOffset: string | undefined) =>
  bottomOffset ? `calc(${bottomOffset} + 0.75rem)` : "3";

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
        <WorkbenchPanelMenuLayout workbench={workbench} panel="side">
          <Flex position="relative" flex="1" minH={0} direction="column">
            <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
          </Flex>
        </WorkbenchPanelMenuLayout>
        <WorkbenchTabDropTarget region="side" visible={attached} />
      </AttachedPanel>
    </WorkbenchFocusRegion>
  );
};

interface WorkbenchFloatingSidePanelProps extends WorkbenchSidePanelProps {
  available?: boolean;
}

export const WorkbenchFloatingSidePanel = (props: WorkbenchFloatingSidePanelProps) => {
  const { workbench, contentSlotRef, bottomOffset, header, bubbleIcon, onOpen, available = true } = props;
  const mode = useWorkbenchStore(workbench.layout.store, () => workbench.sidePanel.getMode());
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state);
  const canFloat = useWorkbenchStore(workbench.modes.store, () => workbench.sidePanel.canFloat());
  const policy = usePanelPolicy(workbench, "side");
  const visible = available && canFloat && (fullscreen.active ? fullscreen.sideOpen : mode === "floating");
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const previousFullscreen = useRef(fullscreen);
  useLayoutEffect(() => {
    const previous = previousFullscreen.current;
    previousFullscreen.current = fullscreen;
    if (!previous.active || !fullscreen.active || !previous.sideOpen || fullscreen.sideOpen) return;
    const frame = requestAnimationFrame(() => bubbleRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [fullscreen]);

  return (
    <>
      {available && canFloat && policy.canOpen && (fullscreen.active || mode !== "attached") ? (
        <BubbleButton
          ref={bubbleRef}
          isOpen={visible}
          aria-label="Open Side Panel"
          containerProps={{ bottom: launcherBottom(bottomOffset) }}
          tooltip="Open Side Panel"
          onClick={
            fullscreen.active
              ? () => workbench.commands.executeCommand("workbench.showFullscreenSide")
              : (onOpen ?? (() => workbench.shell.setSidePanelPresentation("floating")))
          }
        >
          {bubbleIcon ?? <MessageCircle size={20} strokeWidth={2} />}
        </BubbleButton>
      ) : null}
      {/* Both presentation slots stay connected so hiding cannot release a live iframe. */}
      <BubblePanel
        isOpen={visible}
        aria-label="Side Panel"
        testId="workbench-side-panel-floating"
        closeLabel="Close Side Panel"
        containerProps={{
          "data-workbench-panel": "side",
          bottom: floatingPanelBottom(bottomOffset),
          bg: workbenchBackgrounds.main,
        }}
        popOutLabel="Reattach Side Panel"
        header={
          visible ? (
            <PanelHeader workbench={workbench} region="side" variant="main" gap="sm">
              <WorkbenchSidePanelHeader header={header} />
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
                      fullscreen.active ? workbench.fullscreen.hideSide() : workbench.shell.setRegionOpen("side", false)
                    }
                  >
                    <Minus size={16} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </PanelHeader>
          ) : null
        }
        onPopOut={() => workbench.sidePanel.setMode("attached")}
        menu={visible ? <WorkbenchSidePanelHeader header={header} /> : undefined}
        overlay={<WorkbenchTabDropTarget region="side" visible={visible} />}
      >
        <WorkbenchFocusRegion workbench={workbench} region="side" display="flex" flex="1" minH="0">
          <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
        </WorkbenchFocusRegion>
      </BubblePanel>
    </>
  );
};
