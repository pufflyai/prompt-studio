import { Box, HStack, IconButton } from "@chakra-ui/react";
import { Header, Tooltip } from "@pstdio/ui";
import {
  getAnchorResource,
  type WorkbenchCore,
  workbenchTopHeaderLeadingMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "../../core";
import { WorkbenchArea } from "../area/area";
import { WorkbenchBreadcrumbView } from "../breadcrumb/breadcrumb-view";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { type FrameOpenerDetails, resolveFrameOpeners } from "../frame/frame-openers";
import { isFrameSlotVisible, resolveFrameSlotCollapsible, useFrameStoreSnapshot } from "../frame/use-frame-slot-state";
import {
  WorkbenchAuxiliaryHeaderActions,
  WorkbenchHeaderActions,
  WorkbenchResourceActions,
} from "../header/header-actions";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WORKBENCH_TERMINAL_OPEN_COMMAND_ID } from "../terminal/terminal-module";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";
import { resolvePanelCollapsible, setWorkbenchPanelOpen } from "./workbench-panel-state";

interface WorkbenchHeaderProps {
  workbench: WorkbenchCore;
}

const FramePanelOpeners = (props: { workbench: WorkbenchCore; openers: FrameOpenerDetails[] }) => {
  const { workbench, openers } = props;
  if (openers.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {openers.map((opener) => (
        <Tooltip key={opener.id} content={opener.label}>
          <IconButton
            variant="ghost"
            size="xs"
            aria-label={opener.label}
            flexShrink={0}
            onClick={() => {
              if (opener.commandId) {
                void workbench.commands.executeCommand(opener.commandId).catch(() => undefined);
                return;
              }
              setWorkbenchPanelOpen(workbench, opener.id, true);
            }}
          >
            <WorkbenchIcon name={opener.icon} size={16} />
          </IconButton>
        </Tooltip>
      ))}
    </HStack>
  );
};

export const WorkbenchHeader = (props: WorkbenchHeaderProps) => {
  const { workbench } = props;
  const snapshot = useFrameStoreSnapshot(workbench);
  const frame = useWorkbenchStore(workbench.layout.store, (state) => state.frame);
  const hasTop = (snapshot.layout.areas.nav?.widgets.length ?? 0) > 0 || Boolean(snapshot.placeholders.nav);
  const leftSlot = frame.slots.left;
  const leftPanelOpen = snapshot.openByAreaId.left ?? true;
  const showLeftPanelOpener = Boolean(
    leftSlot &&
      isFrameSlotVisible(frame, snapshot, leftSlot) &&
      !leftPanelOpen &&
      resolvePanelCollapsible(workbench, "left"),
  );
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const resource = useWorkbenchStore(workbench.layout.store, (state) =>
    getAnchorResource(state.frame, state.layout, "primary"),
  );
  const breadcrumbItems = useWorkbenchStore(workbench.breadcrumbs.store, (state) => state.items) ?? [];
  const menuState = { itemsByPath, commands, contextValues };
  const menuContext = { resource };
  const hasLeadingActions =
    listWorkbenchMenuItemsFromState(menuState, workbenchTopHeaderLeadingMenuPath, menuContext).length > 0;
  const hasTrailingActions =
    listWorkbenchMenuItemsFromState(menuState, workbenchTopHeaderTrailingMenuPath, menuContext).length > 0;
  const hasBreadcrumb = breadcrumbItems.length > 0;
  const hasCenter = hasTop || hasBreadcrumb;
  const openerPanels = Object.fromEntries(
    ["secondary", "side"].flatMap((id) => {
      const slot = frame.slots[id];
      if (!slot) return [];
      const collapsible = resolveFrameSlotCollapsible(workbench, frame, id);
      const available = isFrameSlotVisible(frame, snapshot, slot);
      return [
        [
          id,
          {
            available,
            collapsed: !(snapshot.openByAreaId[id] ?? true) && collapsible,
            collapsible,
            placements: snapshot.layout.areas[id]?.widgets ?? [],
            openCommandId:
              id === "secondary" && !available && commands[WORKBENCH_TERMINAL_OPEN_COMMAND_ID]
                ? WORKBENCH_TERMINAL_OPEN_COMMAND_ID
                : undefined,
          },
        ],
      ];
    }),
  );
  const openers = resolveFrameOpeners({ panels: openerPanels });

  if (!showLeftPanelOpener && !hasLeadingActions && !hasCenter && !hasTrailingActions && openers.length === 0)
    return null;

  return (
    <Header
      variant="main"
      bg={workbenchBackgrounds.main}
      position="relative"
      flexShrink={0}
      gap="xs"
      overflow="hidden"
      overflowY="hidden"
      w="full"
    >
      {showLeftPanelOpener ? (
        <Tooltip content="Show left side panel">
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Show left side panel"
            flexShrink={0}
            onClick={() => setWorkbenchPanelOpen(workbench, "left", true)}
          >
            <WorkbenchIcon name="PanelLeft" size={16} />
          </IconButton>
        </Tooltip>
      ) : null}
      <WorkbenchHeaderActions workbench={workbench} menuPath={workbenchTopHeaderLeadingMenuPath} />
      <Box flex="1" h="full" minW="0" overflow="hidden">
        {hasTop ? <WorkbenchArea workbench={workbench} area="nav" title="Top" /> : null}
        {!hasTop && (hasBreadcrumb || hasTrailingActions) ? (
          <HStack h="full" minW="0" gap="2xs">
            {hasBreadcrumb ? <WorkbenchBreadcrumbView workbench={workbench} /> : null}
            <WorkbenchResourceActions workbench={workbench} menuPath={workbenchTopHeaderTrailingMenuPath} />
          </HStack>
        ) : null}
      </Box>
      <WorkbenchAuxiliaryHeaderActions workbench={workbench} menuPath={workbenchTopHeaderTrailingMenuPath} />
      <FramePanelOpeners workbench={workbench} openers={openers} />
      <WorkbenchHeaderBorder workbench={workbench} area="nav" />
    </Header>
  );
};

interface WorkbenchAreaPanelProps {
  workbench: WorkbenchCore;
}

export const WorkbenchActivityBar = (props: WorkbenchAreaPanelProps) => {
  const { workbench } = props;

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      area="activityBar"
      as="nav"
      bg={workbenchBackgrounds.activityBar}
      borderRightWidth="1px"
      borderColor="border.subtle"
      flexShrink={0}
      h="full"
      minH="0"
      overflow="hidden"
      w="full"
    >
      <WorkbenchArea workbench={workbench} area="activity" title="Activity bar" />
    </WorkbenchFocusRegion>
  );
};

export const WorkbenchStatusBar = (props: WorkbenchAreaPanelProps) => {
  const { workbench } = props;

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      area="statusBar"
      as="footer"
      bg={workbenchBackgrounds.statusBar}
      borderTopWidth="1px"
      borderColor="border.subtle"
      flexShrink={0}
      h="full"
      minH="0"
      minW="0"
      overflow="hidden"
      w="full"
    >
      <WorkbenchArea workbench={workbench} area="status" title="Status" />
    </WorkbenchFocusRegion>
  );
};
