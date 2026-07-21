import { IconButton, Menu, Portal, Tabs } from "@chakra-ui/react";
import {
  buildTabVisibilityMenuActions,
  filterVisibleTabs,
  ListRow,
  PANEL_HEADER_CONTROL_SIZE,
  PANEL_HEADER_TAB_SIZE,
  ScrollArea,
  Tooltip,
  useTabVisibilityStore,
} from "@pstdio/ui";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useState } from "react";
import {
  type WorkbenchCore,
  type WorkbenchPanelRegion,
  type WorkbenchRegion as WorkbenchRegionId,
  type WorkbenchWidgetPlacement,
  workbenchPanelRegions,
  workbenchRegionTabLeadingMenuPath,
} from "../../core";
import { hasCommandParameters } from "../command-palette/command-palette-params";
import type { WorkbenchMenuItem } from "../menus/menu-items";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchPanelAddMenu } from "./panel-add-menu";
import { WorkbenchRegionTab } from "./region-tab";
import { resolveDisplayedActiveWidgetId, toTabKey } from "./region-tabs-visibility";

interface WorkbenchRegionTabsProps {
  workbench: WorkbenchCore;
  region: WorkbenchRegionId;
  visibilityStorageKey?: string;
}

const isPlacementCloseable = (placement: WorkbenchWidgetPlacement) => placement.closable === true;

const isWorkbenchPanelRegion = (region: WorkbenchRegionId): region is WorkbenchPanelRegion =>
  workbenchPanelRegions.some((panelRegion) => panelRegion === region);

export const shouldShowRegionTabs = (
  placements: WorkbenchWidgetPlacement[],
  options: { hasLeadingActions?: boolean; hasAddAction?: boolean } = {},
) =>
  options.hasAddAction === true ||
  options.hasLeadingActions === true ||
  placements.length > 1 ||
  placements.some(isPlacementCloseable);

export const useWorkbenchRegionTabsVisible = (workbench: WorkbenchCore, region: WorkbenchRegionId) => {
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const placements = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions[region].widgets);
  const leadingItems = listWorkbenchMenuItemsFromState(
    { itemsByPath, commands, contextValues },
    workbenchRegionTabLeadingMenuPath(region),
  );

  return shouldShowRegionTabs(placements, {
    hasLeadingActions: leadingItems.length > 0,
    hasAddAction: isWorkbenchPanelRegion(region),
  });
};

export const WorkbenchRegionTabs = (props: WorkbenchRegionTabsProps) => {
  const { workbench, region, visibilityStorageKey } = props;
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const regionState = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions[region]);
  const placements = regionState.widgets;
  // Visibility is on by default; the host can override the storage key. When no key is supplied, fall
  // back to the region id so persistence has a sensible default.
  const visibilityKey = visibilityStorageKey ?? region;
  const tabStore = useTabVisibilityStore(visibilityKey, (state) => state);
  const tabOverrides = tabStore.tabOverrides;
  const getKey = (placement: WorkbenchWidgetPlacement) => toTabKey(region, placement);
  const visiblePlacements = filterVisibleTabs(placements, tabOverrides, getKey);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const resolvePlacementIcon = (placement: WorkbenchWidgetPlacement) => {
    const iconName =
      placement.resource?.icon ??
      (placement.resource ? workbench.resources.getKind(placement.resource.kind)?.icon : undefined);
    return iconName ? <WorkbenchIcon name={iconName} size={14} /> : undefined;
  };

  const menuActions = buildTabVisibilityMenuActions(
    placements,
    tabOverrides,
    {
      onToggleTab: (key, hiddenByDefault) => tabStore.toggleTab(key, hiddenByDefault),
      onResetAll: () => tabStore.reset(),
    },
    getKey,
    {
      visibleIcon: <WorkbenchIcon name="eye" size={14} />,
      hiddenIcon: <WorkbenchIcon name="eye-off" size={14} />,
      resetIcon: <WorkbenchIcon name="rotate-ccw" size={14} />,
    },
    resolvePlacementIcon,
  );
  const hasVisibilityMenu = menuActions.length > 0;
  const leadingItems = listWorkbenchMenuItemsFromState(
    { itemsByPath, commands, contextValues },
    workbenchRegionTabLeadingMenuPath(region),
  );
  const panelRegion = isWorkbenchPanelRegion(region) ? region : undefined;
  const showTabs = shouldShowRegionTabs(visiblePlacements, {
    hasLeadingActions: leadingItems.length > 0,
    hasAddAction: Boolean(panelRegion),
  });

  const openVisibilityMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (!hasVisibilityMenu) return;

    event.preventDefault();
    const target = event.target instanceof Element ? event.target.closest('[role="tab"]') : undefined;
    const rect = (target ?? event.currentTarget).getBoundingClientRect();
    setAnchor({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    setMenuOpen(true);
  };

  // Translate vertical wheel into horizontal scrolling so the tab strip scrolls
  // with a plain mouse wheel — no modifier key required.
  useEffect(() => {
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0 || viewport.scrollWidth <= viewport.clientWidth) return;
      viewport.scrollLeft += event.deltaY;
      event.preventDefault();
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [viewport]);

  if (!showTabs) return null;

  const activeWidgetId = resolveDisplayedActiveWidgetId(visiblePlacements, regionState.activeWidgetId);
  const onSelectLeadingItem = (item: WorkbenchMenuItem) => {
    const command = commands[item.commandId]?.command;
    if (command && hasCommandParameters(command.params)) {
      workbench.commandPalette.requestParams({ record: { command }, label: item.label, args: item.args });
      return;
    }
    void workbench.commands.executeCommand(item.commandId, item.args).catch(() => undefined);
  };

  return (
    <Tabs.Root
      value={activeWidgetId}
      onValueChange={(details) => workbench.layout.activateWidget(details.value)}
      variant="subtle"
      colorPalette="gray"
      justify="start"
      size={PANEL_HEADER_TAB_SIZE}
      alignSelf="stretch"
      flex="1 1 auto"
      maxW="full"
      minW="0"
      h="full"
      position="relative"
      zIndex="1"
      onContextMenu={hasVisibilityMenu ? openVisibilityMenu : undefined}
    >
      {/* Overflowing tabs scroll horizontally; the overlay scrollbar adds no
          height so the active tab still meets the header's bottom edge. */}
      <ScrollArea
        viewportRef={setViewport}
        size="xs"
        h="full"
        w="max-content"
        maxW="full"
        minW="0"
        showVerticalScrollbar={false}
        showHorizontalScrollbar
        contentProps={{ h: "full" }}
      >
        {/* Chakra's size="sm" list sets a 36px min-height that overflows the 2rem header and
            makes the horizontal-only viewport scroll vertically; minH="0" lets h="full" win. */}
        <Tabs.List h="full" minH="0" minW="max-content" alignItems="center" gap="2xs" justifyContent="flex-start">
          {visiblePlacements.map((placement) => (
            <WorkbenchRegionTab
              key={placement.widgetId}
              workbench={workbench}
              placement={placement}
              activeWidgetId={activeWidgetId}
            />
          ))}
          {panelRegion ? <WorkbenchPanelAddMenu workbench={workbench} region={panelRegion} /> : null}
          {leadingItems.map((item) => (
            <Tooltip key={item.id} content={item.label}>
              <IconButton
                size={PANEL_HEADER_CONTROL_SIZE}
                variant="ghost"
                aria-label={item.label}
                disabled={item.disabled}
                flexShrink={0}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectLeadingItem(item);
                }}
              >
                <WorkbenchIcon name={item.icon ?? "plus"} size={14} />
              </IconButton>
            </Tooltip>
          ))}
        </Tabs.List>
      </ScrollArea>
      {hasVisibilityMenu ? (
        <Menu.Root
          open={menuOpen}
          onOpenChange={(details) => setMenuOpen(details.open)}
          positioning={{
            placement: "bottom-start",
            getAnchorRect: () => anchor,
            offset: { mainAxis: 0 },
          }}
        >
          <Portal>
            <Menu.Positioner>
              <Menu.Content minW="220px" bg="bg">
                {menuActions.map((action) => (
                  <Menu.Item key={action.key} value={action.key} asChild>
                    <ListRow
                      asChild
                      variant="full-width"
                      label={action.label}
                      icon={action.icon}
                      endContent={action.endContent}
                      disabled={action.isDisabled}
                      onActivate={action.onClick}
                    />
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      ) : null}
    </Tabs.Root>
  );
};
