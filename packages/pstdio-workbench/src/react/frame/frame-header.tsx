import { Box, HStack, IconButton } from "@chakra-ui/react";
import { Header, Tooltip } from "@pstdio/ui";
import { type Frame, type FrameSlot, getAnchorResource, headerTrailingMenuPath, type WorkbenchCore } from "../../core";
import { WorkbenchArea } from "../area/area";
import { shouldShowAreaTabs, WorkbenchAreaTabs } from "../area/area-tabs";
import { useAreaLeadingItems } from "../area/use-area-leading-items";
import { usePanelMenus } from "../area/use-panel-menus";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getWorkbenchAreaBackground } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "../workbench/header-bottom-border";
import { setWorkbenchPanelOpen } from "../workbench/workbench-panel-state";
import { type FrameOpenerDetails, resolveFrameOpeners } from "./frame-openers";
import { resolveSlotChrome } from "./frame-slot-chrome";
import { isFrameSlotVisible, resolveFrameSlotCollapsible, useFrameStoreSnapshot } from "./use-frame-slot-state";

interface FramePanelOpenersProps {
  workbench: WorkbenchCore;
  openers: FrameOpenerDetails[];
}

const FramePanelOpeners = (props: FramePanelOpenersProps) => {
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
            onClick={() => setWorkbenchPanelOpen(workbench, opener.id, true)}
          >
            <WorkbenchIcon name={opener.icon} size={16} />
          </IconButton>
        </Tooltip>
      ))}
    </HStack>
  );
};

interface FrameHeaderProps {
  workbench: WorkbenchCore;
  frame: Frame;
  targetSlot: FrameSlot;
  headerSlot?: FrameSlot;
}

export const FrameHeader = (props: FrameHeaderProps) => {
  const { workbench, frame, targetSlot, headerSlot } = props;
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const snapshot = useFrameStoreSnapshot(workbench);
  const leading = useAreaLeadingItems(workbench, targetSlot.id);
  const panelMenus = usePanelMenus(workbench, targetSlot.id);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const targetPlacements = panelMenus.tabs;
  const hasHeader = headerSlot
    ? (snapshot.layout.areas[headerSlot.id]?.widgets.length ?? 0) > 0 || Boolean(snapshot.placeholders[headerSlot.id])
    : false;
  const menuState = { itemsByPath, commands, contextValues };
  const hasTargetTabs = shouldShowAreaTabs(targetPlacements, {
    hasLeadingActions: leading.items.length > 0,
    hasOpenablePanels: leading.openablePanels.length > 0,
    hasPanelMenuToggles: panelMenus.toggles.length > 0,
  });
  const resource = getAnchorResource(frame, snapshot.layout, "primary");
  const trailingMenuPath = headerTrailingMenuPath(targetSlot.id);
  const hasTrailingActions =
    targetSlot.id === frame.primary &&
    listWorkbenchMenuItemsFromState(menuState, trailingMenuPath, { resource }).length > 0;
  const openerPanels = Object.fromEntries(
    ["main-left", "secondary", "side"].flatMap((id) => {
      const slot = frame.slots[id];
      if (!slot) return [];
      const collapsible = resolveFrameSlotCollapsible(workbench, frame, id);
      return [
        [
          id,
          {
            available: isFrameSlotVisible(frame, snapshot, slot),
            collapsed: !(snapshot.openByAreaId[id] ?? true) && collapsible,
            collapsible,
            placements: snapshot.layout.areas[id]?.widgets ?? [],
          },
        ],
      ];
    }),
  );
  const openers = targetSlot.id === frame.primary ? resolveFrameOpeners({ panels: openerPanels }) : [];

  if (!hasHeader && !hasTargetTabs && !hasTrailingActions && openers.length === 0) return null;

  const chrome = resolveSlotChrome(headerSlot?.id ?? targetSlot.id);
  const borderSlotId = headerSlot?.id ?? targetSlot.id;

  return (
    <Header
      variant={chrome.headerVariant}
      bg={getWorkbenchAreaBackground(borderSlotId)}
      position="relative"
      flexShrink={0}
      gap="xs"
      overflow="hidden"
      overflowY="hidden"
    >
      <WorkbenchAreaTabs workbench={workbench} area={targetSlot.id} />
      {(hasHeader && headerSlot) || chrome.growHeaderWhenEmpty ? (
        <Box flex={hasHeader || !hasTargetTabs ? "1" : "0"} h="full" minW="0" overflow="hidden">
          {hasHeader && headerSlot ? (
            <WorkbenchArea workbench={workbench} area={headerSlot.id} title={`${targetSlot.id} header`} />
          ) : null}
        </Box>
      ) : null}
      {targetSlot.id === frame.primary ? (
        <WorkbenchHeaderActions workbench={workbench} menuPath={trailingMenuPath} />
      ) : null}
      <FramePanelOpeners workbench={workbench} openers={openers} />
      <WorkbenchHeaderBorder workbench={workbench} area={borderSlotId} />
    </Header>
  );
};
