import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { AttachedPanel, BubblePanel, Header, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { Minimize2 } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { floatingBubbleAnchor } from "../../core/controllers/side-panel/floating-bubble-position";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { PanelDragHandle } from "../region/panel-drag-area";
import { PanelHeaderContextMenu, PanelHeaderEdge } from "../region/panel-header-menu";
import { useWorkbenchRegionTabsVisible } from "../region/region-tabs";
import { WorkbenchTabDropTarget } from "../region/tab-drag-context";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { useEffectiveSideMode } from "../workbench/use-main-fullscreen";
import { FloatingBubble } from "./floating-bubble";

interface WorkbenchSidePanelProps {
  workbench: WorkbenchCore;
  contentSlotRef: (node: HTMLDivElement | null) => void;
  header?: ReactNode;
  bubbleIcon?: ReactNode;
}

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
  const policy = usePanelPolicy(workbench, "side");
  const canFloat = useWorkbenchStore(workbench.modes.store, () => workbench.sidePanel.canFloat());
  const attached = useWorkbenchStore(workbench.layout.store, () => workbench.sidePanel.getMode() === "attached");
  const hasTabs = useWorkbenchRegionTabsVisible(workbench, "side");
  const showHeader = policy.legacyHeaders
    ? (policy.showHeader || hasTabs) && Boolean(header || canFloat)
    : policy.showHeader;

  return (
    <WorkbenchFocusRegion workbench={workbench} region="side" h="full" minH="0" minW="0" w="full">
      <AttachedPanel
        data-testid="workbench-side-panel-attached"
        data-workbench-panel="side"
        data-workbench-region="side"
        width="full"
        minWidth="0"
        bg={workbenchBackgrounds.widget}
        layerStyle="panel"
        header={
          showHeader && attached ? (
            <PanelHeaderContextMenu workbench={workbench} region="side">
              <PanelDragHandle workbench={workbench} panel="side" asChild>
                <Header
                  data-workbench-panel-header="side"
                  aria-label="side header"
                  tabIndex={0}
                  variant="main"
                  flexShrink={0}
                  gap="sm"
                >
                  <WorkbenchSidePanelHeader header={header} />
                  <WorkbenchPanelMenuOpeners workbench={workbench} panel="side" />
                  {canFloat ? (
                    <Tooltip content="Float Side Panel">
                      <IconButton
                        size={PANEL_HEADER_CONTROL_SIZE}
                        variant="ghost"
                        aria-label="Float Side Panel"
                        onClick={() => workbench.sidePanel.setMode("floating")}
                      >
                        <Minimize2 size={16} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Header>
              </PanelDragHandle>
            </PanelHeaderContextMenu>
          ) : undefined
        }
      >
        <WorkbenchPanelMenuLayout workbench={workbench} panel="side">
          <Flex position="relative" flex="1" minH={0} direction="column">
            <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
          </Flex>
        </WorkbenchPanelMenuLayout>
        <PanelHeaderEdge workbench={workbench} region="side" visible={showHeader} />
        <WorkbenchTabDropTarget workbench={workbench} region="side" />
      </AttachedPanel>
    </WorkbenchFocusRegion>
  );
};

interface WorkbenchFloatingSidePanelProps extends WorkbenchSidePanelProps {
  available?: boolean;
}

export const WorkbenchFloatingSidePanel = (props: WorkbenchFloatingSidePanelProps) => {
  const { workbench, contentSlotRef, header, bubbleIcon, available = true } = props;
  const mode = useEffectiveSideMode(workbench);
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  const canFloat = useWorkbenchStore(workbench.modes.store, () => workbench.sidePanel.canFloat());
  const policy = usePanelPolicy(workbench, "side");
  const visible = available && canFloat && mode === "floating";
  const showHeader = policy.legacyHeaders || policy.showHeader;
  const modeId = useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const anchor = useWorkbenchStore(workbench.layout.store, () =>
    floatingBubbleAnchor(workbench.sidePanel.getBubblePosition()),
  );

  return (
    <>
      {!fullscreen && available && canFloat && policy.floatingBubble && policy.canOpen && mode !== "attached" ? (
        <FloatingBubble
          key={modeId}
          workbench={workbench}
          open={visible}
          canClose={policy.canClose}
          icon={bubbleIcon}
        />
      ) : null}
      {/* Both presentation slots stay connected so hiding cannot release a live iframe. */}
      <BubblePanel
        isOpen={visible}
        aria-label="Side Panel"
        testId="workbench-side-panel-floating"
        anchor={anchor}
        portalled={false}
        showHeader={showHeader}
        containerProps={{
          "data-workbench-panel": "side",
          position: "absolute",
          pointerEvents: "auto",
          bg: workbenchBackgrounds.widget,
        }}
        popOutLabel="Reattach Side Panel"
        onPopOut={fullscreen ? undefined : () => workbench.sidePanel.setMode("attached")}
        closeLabel="Hide Sidebar"
        onClose={fullscreen && policy.canClose ? () => workbench.fullscreen.hideSide() : undefined}
        menu={
          visible ? (
            <PanelHeaderContextMenu workbench={workbench} region="side">
              <Box flex="1" minW="0" aria-label="side header" tabIndex={0} data-workbench-panel-header="side">
                <WorkbenchSidePanelHeader header={header} />
              </Box>
            </PanelHeaderContextMenu>
          ) : undefined
        }
        overlay={
          <>
            <PanelHeaderEdge workbench={workbench} region="side" visible={showHeader} />
            <WorkbenchTabDropTarget workbench={workbench} region="side" />
          </>
        }
      >
        <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
      </BubblePanel>
    </>
  );
};
