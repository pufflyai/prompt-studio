import { Box, IconButton } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, ScopedPopover as Popover, Portal, ResourceContextMenu, Tooltip } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { openOwnedViewMenu, selectViewMenuPlacement } from "../../core/controllers/panel-menus/open-view-menu";
import { useMenuHeaderSettings } from "../header/use-menu-header-settings";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchActivePanel } from "../shared/use-workbench-active-panel";
import { useFloatingMenu } from "./floating-menu-context";
import { type PanelMenuEntry, resolvePanelMenuEntries } from "./panel-menu-entries";
import { WorkbenchPanelMenuSlot } from "./panel-menu-hosts";
import type { WorkbenchPanelMenuView } from "./use-panel-menu";

export const WorkbenchPanelMenuButton = (props: {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelRegion;
  entry: PanelMenuEntry;
  view: WorkbenchPanelMenuView;
}) => {
  const { workbench, panel, entry, view } = props;
  const owner = useWorkbenchActivePanel(workbench, panel);
  const { configure } = useMenuHeaderSettings(workbench, owner);
  const floatingMenu = useFloatingMenu();
  const activity = workbench.viewMenus.getViewMenu(entry.id)?.purpose === "activity";
  const maxWidth = activity ? 480 : 320;
  const width = floatingMenu.size.width || maxWidth;
  const minWidth = Math.min(activity ? 400 : 240, width);
  const open = view.canAttach
    ? view.placementId === entry.placement.widgetId && !view.collapsed
    : floatingMenu.ids.includes(entry.placement.widgetId);
  const select = (nextOpen: boolean) => {
    const peers = resolvePanelMenuEntries(workbench, panel);
    if (!peers.some((candidate) => candidate.placement.widgetId === entry.placement.widgetId)) return;
    const closing = peers.filter((candidate) => candidate.region === entry.region);
    if (!view.canAttach) {
      floatingMenu.setOpen(
        entry.placement.widgetId,
        nextOpen,
        closing.map((peer) => peer.placement.widgetId),
      );
      if (nextOpen) selectViewMenuPlacement(workbench, entry.placement.widgetId);
      return;
    }
    workbench.panelMenuState.setSelection(
      closing.map((candidate) => candidate.key),
      nextOpen ? entry.key : undefined,
    );
    for (const peer of closing) floatingMenu.setOpen(peer.placement.widgetId, false);
    if (nextOpen) selectViewMenuPlacement(workbench, entry.placement.widgetId);
  };
  const sameSide = resolvePanelMenuEntries(workbench, panel).filter((candidate) => candidate.region === entry.region);
  const label = `${open ? "Close" : "Open"} ${view.label}${sameSide.length > 1 ? `: ${entry.title}` : ""}`;
  const icon = <WorkbenchIcon name={entry.icon} size={14} />;
  const triggerProps = {
    id: `menu-opener-${entry.placement.widgetId}`,
    "aria-label": label,
    "aria-expanded": open,
    "data-workbench-menu-id": entry.id,
  };
  const actions = (["left", "right", "bottom"] as const).map((side) => ({
    key: side,
    label: `Open ${entry.title} on the ${side}`,
    isSelected: entry.side === side,
    onClick: async () => {
      const projectId = workbench.pages.store.getState().projectId;
      await configure({ menuSides: { [entry.id]: side } });
      if (projectId !== workbench.pages.store.getState().projectId || !owner) return;
      const current = resolvePanelMenuEntries(workbench, panel).find(
        (candidate) => candidate.placement.widgetId === entry.placement.widgetId,
      );
      if (current?.side !== side) return;
      openOwnedViewMenu(workbench, owner.widgetId, entry.id);
      const peers = resolvePanelMenuEntries(workbench, panel)
        .filter((candidate) => candidate.region === current.region)
        .map((candidate) => candidate.placement.widgetId);
      floatingMenu.setOpen(entry.placement.widgetId, true, peers);
    },
  }));
  const button = (
    <Tooltip content={entry.title}>
      <IconButton
        {...triggerProps}
        size={PANEL_HEADER_CONTROL_SIZE}
        variant="ghost"
        onClick={view.canAttach ? () => select(!open) : undefined}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
  return (
    <ResourceContextMenu actions={actions}>
      <Box display="flex">
        {view.canAttach ? (
          button
        ) : (
          <Popover.Root
            ids={{ trigger: triggerProps.id }}
            open={open}
            onOpenChange={({ open }) => select(open)}
            closeOnInteractOutside={false}
            lazyMount={false}
            unmountOnExit={false}
            positioning={{
              placement: entry.side === "left" ? "bottom-start" : "bottom-end",
              getAnchorRect: () => {
                const rect = floatingMenu.bounds.current?.getBoundingClientRect();
                return rect ? { x: rect.x, y: rect.y, width: rect.width, height: 0 } : null;
              },
              offset: { mainAxis: 0 },
              flip: false,
              slide: false,
              overflowPadding: 0,
            }}
          >
            <Tooltip content={entry.title} ids={{ trigger: triggerProps.id }}>
              <Popover.Trigger asChild>
                <IconButton {...triggerProps} size={PANEL_HEADER_CONTROL_SIZE} variant="ghost">
                  {icon}
                </IconButton>
              </Popover.Trigger>
            </Tooltip>
            <Portal>
              <Popover.Positioner>
                <Popover.Content
                  aria-label={entry.title}
                  w="max-content"
                  minW={`min(${minWidth}px, var(--available-width))`}
                  maxW={`min(${Math.min(maxWidth, width)}px, var(--available-width))`}
                  maxH={floatingMenu.size.height ? `${floatingMenu.size.height}px` : "var(--available-height)"}
                  overflow="hidden"
                  css={
                    floatingMenu.size.height
                      ? {
                          "& iframe, & [data-workbench-region-scroll] > [data-part=viewport]": {
                            maxHeight: `${Math.max(0, floatingMenu.size.height - 2)}px`,
                          },
                        }
                      : undefined
                  }
                  p="0"
                >
                  {view.placementId === entry.placement.widgetId ? (
                    <WorkbenchPanelMenuSlot
                      key={entry.region}
                      region={entry.region}
                      presentation="floating"
                      active={open}
                    />
                  ) : null}
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
        )}
      </Box>
    </ResourceContextMenu>
  );
};
