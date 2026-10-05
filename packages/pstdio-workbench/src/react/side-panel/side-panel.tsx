import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { AttachedPanel, BubbleButton, BubblePanel, Header, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { MessageCircle, Minimize2 } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { useWorkbenchRegionTabsVisible } from "../region/region-tabs";
import { WorkbenchTabDropTarget } from "../region/tab-drag-context";
import { useWorkbenchModeRegionSettings } from "../shared/use-workbench-mode-region-settings";
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
  const settings = useWorkbenchModeRegionSettings(workbench, "side");
  const canFloat = useWorkbenchStore(workbench.modes.store, () => workbench.sidePanel.canFloat());
  const attached = useWorkbenchStore(workbench.layout.store, () => workbench.sidePanel.getMode() === "attached");
  const hasTabs = useWorkbenchRegionTabsVisible(workbench, "side");
  const showHeader = (settings?.showHeader !== false || hasTabs) && Boolean(header || canFloat);

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
            <Header data-workbench-panel-header="side" variant="main" flexShrink={0} gap="sm">
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
          ) : undefined
        }
      >
        <WorkbenchPanelMenuLayout workbench={workbench} panel="side">
          <Flex position="relative" flex="1" minH={0} direction="column">
            <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
          </Flex>
        </WorkbenchPanelMenuLayout>
        <WorkbenchTabDropTarget region="side" />
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
  const canFloat = useWorkbenchStore(workbench.modes.store, () => workbench.sidePanel.canFloat());
  const visible = available && canFloat && mode === "floating";

  return (
    <>
      {available && canFloat && mode === "closed" ? (
        <BubbleButton
          aria-label="Open Side Panel"
          containerProps={{ bottom: launcherBottom(bottomOffset) }}
          tooltip="Open Side Panel"
          onClick={onOpen ?? (() => workbench.sidePanel.setMode("floating"))}
        >
          {bubbleIcon ?? <MessageCircle size={20} strokeWidth={2} />}
        </BubbleButton>
      ) : null}
      {/* Both presentation slots stay connected so hiding cannot release a live iframe. */}
      <BubblePanel
        isOpen
        aria-label="Side Panel"
        testId="workbench-side-panel-floating"
        closeLabel="Close Side Panel"
        containerProps={{
          "data-workbench-panel": "side",
          bottom: floatingPanelBottom(bottomOffset),
          bg: workbenchBackgrounds.widget,
          display: visible ? "block" : "none",
          inert: !visible,
        }}
        popOutLabel="Reattach Side Panel"
        onClose={() => workbench.sidePanel.setMode("closed")}
        onPopOut={() => workbench.sidePanel.setMode("attached")}
        menu={visible ? <WorkbenchSidePanelHeader header={header} /> : undefined}
        overlay={<WorkbenchTabDropTarget region="side" />}
      >
        <Flex ref={contentSlotRef} flex="1" minH={0} direction="column" />
      </BubblePanel>
    </>
  );
};
