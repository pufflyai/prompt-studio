import { HStack, IconButton, Menu, Portal, Tabs } from "@chakra-ui/react";
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
  listEligibleSubPanels,
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
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchPanelAddMenu } from "./panel-add-menu";
import { resolveDisplayedActiveWidgetId, toTabKey } from "./region-tabs-visibility";
import { isPlacementEligibleForRegion, shouldShowRegionTabs } from "./region-tabs-visibility-hooks";
import { SortableRegionTabList } from "./sortable-region-tab-list";

export {
  shouldShowPanelHeader,
  shouldShowRegionTabs,
  useWorkbenchPanelHeaderVisible,
  useWorkbenchRegionTabsVisible,
} from "./region-tabs-visibility-hooks";

interface WorkbenchRegionTabsProps {
  workbench: WorkbenchCore;
  region: WorkbenchRegionId;
  visibilityStorageKey?: string;
}

const isWorkbenchPanelRegion = (region: WorkbenchRegionId): region is WorkbenchPanelRegion =>
  workbenchPanelRegions.some((panelRegion) => panelRegion === region);

export const WorkbenchRegionTabs = (props: WorkbenchRegionTabsProps) => {
  const { workbench, region, visibilityStorageKey } = props;
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const historyHydrating = useWorkbenchStore(workbench.history.store, (state) => state.hydrating);
  const regionState = layoutState.layout.regions[region];
  const registeredWidgets = layoutState.widgets;
  const resource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const subPanelPlacements = regionState.widgets.filter(
    (placement) =>
      (placement.role ?? workbench.layout.getWidget(placement.contributionId)?.role) === "sub-panel" &&
      isPlacementEligibleForRegion(workbench, region, placement, resource, modeId),
  );
  // Visibility is on by default; the host can override the storage key. When no key is supplied, fall
  // back to the region id so persistence has a sensible default.
  const visibilityKey = visibilityStorageKey ?? region;
  const tabStore = useTabVisibilityStore(visibilityKey, (state) => state);
  const tabOverrides = tabStore.tabOverrides;
  const getKey = (placement: WorkbenchWidgetPlacement) => toTabKey(region, placement);
  const visibleSubPanels = filterVisibleTabs(subPanelPlacements, tabOverrides, getKey);
  const visibleSubPanelIds = new Set(visibleSubPanels.map((placement) => placement.widgetId));
  const locationPanels =
    region === "main"
      ? regionState.widgets.filter(
          (placement) => (placement.role ?? workbench.layout.getWidget(placement.contributionId)?.role) === "location",
        )
      : [];
  const visiblePlacements =
    locationPanels.length + visibleSubPanels.length > 1
      ? regionState.widgets.filter(
          (placement) =>
            locationPanels.some((location) => location.widgetId === placement.widgetId) ||
            visibleSubPanelIds.has(placement.widgetId),
        )
      : visibleSubPanels;
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
    subPanelPlacements,
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
  const eligibleSubPanels = panelRegion
    ? listEligibleSubPanels({
        widgets: Object.values(registeredWidgets),
        layout: layoutState.layout,
        region: panelRegion,
        resource,
        modeId,
      })
    : [];
  const hasAddAction = eligibleSubPanels.length > 0;
  const showTabs = shouldShowRegionTabs(visiblePlacements, {
    hasLeadingActions: leadingItems.length > 0,
    hasAddAction,
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

  const leadingActions = leadingItems.map((item) => (
    <Tooltip key={item.id} content={item.label}>
      <IconButton
        size={PANEL_HEADER_CONTROL_SIZE}
        variant="ghost"
        aria-label={item.label}
        disabled={historyHydrating || item.disabled}
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
  ));

  if (visiblePlacements.length === 0) {
    return (
      <HStack flex="1 1 auto" h="full" minW="0" gap="2xs">
        {panelRegion ? (
          <WorkbenchPanelAddMenu
            workbench={workbench}
            region={panelRegion}
            resource={resource}
            widgets={eligibleSubPanels}
          />
        ) : null}
        {leadingActions}
      </HStack>
    );
  }

  return (
    <Tabs.Root
      value={activeWidgetId}
      onValueChange={(details) => {
        if (historyHydrating) return;
        const placement = visiblePlacements.find((candidate) => candidate.widgetId === details.value);
        if (placement?.role === "location") {
          workbench.layout.setRegionActiveWidget(region, placement.widgetId);
          return;
        }
        workbench.layout.activatePanel(details.value);
      }}
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
        <SortableRegionTabList
          workbench={workbench}
          placements={visiblePlacements}
          activeWidgetId={activeWidgetId}
          disabled={historyHydrating}
          panelRegion={panelRegion}
          resource={resource}
          eligibleSubPanels={eligibleSubPanels}
          leadingActions={leadingActions}
        />
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
