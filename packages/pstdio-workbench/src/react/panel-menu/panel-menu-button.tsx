import { Box, IconButton } from "@chakra-ui/react";
import {
  BubbleButton,
  PANEL_HEADER_CONTROL_SIZE,
  ScopedPopover as Popover,
  Portal,
  ResourceContextMenu,
  Tooltip,
} from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { openOwnedViewMenu, selectViewMenuPlacement } from "../../core/controllers/panel-menus/open-view-menu";
import { useMenuHeaderSettings } from "../header/use-menu-header-settings";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchActivePanel } from "../shared/use-workbench-active-panel";
import { useFloatingMenu } from "./floating-menu-context";
import { type PanelMenuEntry, resolvePanelMenuEntries } from "./panel-menu-entries";
import { WorkbenchPanelMenuSlot } from "./panel-menu-hosts";
import type { WorkbenchPanelMenuView } from "./use-panel-menu";
import { usePanelMenuContent } from "./use-panel-menu-content";

export const WorkbenchPanelMenuButton = (props: {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelRegion;
  entry: PanelMenuEntry;
  floating?: boolean;
  view: WorkbenchPanelMenuView;
}) => {
  const { workbench, panel, entry, view, floating = false } = props;
  const owner = useWorkbenchActivePanel(workbench, panel);
  const { settings, configure } = useMenuHeaderSettings(workbench, owner);
  const hasContent = usePanelMenuContent(workbench, entry.placement);
  const floatingMenu = useFloatingMenu();
  const open = view.canAttach
    ? view.placementId === entry.placement.widgetId && !view.collapsed
    : floatingMenu.id === entry.placement.widgetId;
  const select = (nextOpen: boolean) => {
    const peers = resolvePanelMenuEntries(workbench, panel);
    if (!peers.some((candidate) => candidate.placement.widgetId === entry.placement.widgetId)) return;
    if (!view.canAttach) {
      floatingMenu.select(nextOpen ? entry.placement.widgetId : undefined);
      if (nextOpen) selectViewMenuPlacement(workbench, entry.placement.widgetId);
      return;
    }
    const closing = settings.multipleMenus ? peers.filter((candidate) => candidate.region === entry.region) : peers;
    workbench.panelMenuState.setSelection(
      closing.map((candidate) => candidate.key),
      nextOpen ? entry.key : undefined,
    );
    if (closing.some((candidate) => candidate.placement.widgetId === floatingMenu.id)) floatingMenu.select(undefined);
    if (nextOpen) selectViewMenuPlacement(workbench, entry.placement.widgetId);
  };
  if (!hasContent) return null;
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
      floatingMenu.select(entry.placement.widgetId);
    },
  }));
  const button = floating ? (
    <BubbleButton
      {...triggerProps}
      containerProps={{ position: "relative", bottom: "auto", right: "auto" }}
      tooltip={entry.title}
      onClick={view.canAttach ? () => select(!open) : undefined}
    >
      {icon}
    </BubbleButton>
  ) : (
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
            open={open}
            onOpenChange={({ open }) => select(open)}
            lazyMount={false}
            unmountOnExit={false}
            positioning={{ placement: entry.side === "left" ? "bottom-start" : "bottom-end", flip: true }}
          >
            <Popover.Trigger asChild>
              {floating ? (
                <BubbleButton
                  {...triggerProps}
                  containerProps={{ position: "relative", bottom: "auto", right: "auto" }}
                  tooltip={entry.title}
                >
                  {icon}
                </BubbleButton>
              ) : (
                <IconButton {...triggerProps} size={PANEL_HEADER_CONTROL_SIZE} variant="ghost">
                  {icon}
                </IconButton>
              )}
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content aria-label={entry.title} w="72" h="80" maxH="var(--available-height)" p="0">
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
