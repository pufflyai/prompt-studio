import { HStack, IconButton, Menu, Portal, Tabs } from "@chakra-ui/react";
import {
  buildTabVisibilityMenuActions,
  ListRow,
  PANEL_HEADER_CONTROL_SIZE,
  PANEL_HEADER_TAB_SIZE,
  ScrollArea,
  Tooltip,
} from "@pstdio/ui";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useState } from "react";
import type { WorkbenchCore, WorkbenchRegion as WorkbenchRegionId, WorkbenchWidgetPlacement } from "../../core";
import { hasCommandParameters } from "../command-palette/command-palette-params";
import type { WorkbenchMenuItem } from "../menus/menu-items";
import { WorkbenchIcon } from "../shared/icon";
import { WorkbenchPanelAddMenu } from "./panel-add-menu";
import { resolveDisplayedActiveWidgetId, resolveTabIconName, toTabKey } from "./region-tabs-visibility";
import { useWorkbenchRegionTabsState } from "./region-tabs-visibility-hooks";
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
const resolvePlacementIcon = (workbench: WorkbenchCore, placement: WorkbenchWidgetPlacement) => {
  const iconName = resolveTabIconName(
    placement,
    workbench.layout.getWidget(placement.contributionId),
    placement.resource ? workbench.resources.getKind(placement.resource.type)?.icon : undefined,
  );
  return iconName ? <WorkbenchIcon name={iconName} size={14} /> : undefined;
};
export const WorkbenchRegionTabs = (props: WorkbenchRegionTabsProps) => {
  const { workbench, region, visibilityStorageKey } = props;
  const {
    commands,
    regionState,
    resource,
    tabStore,
    subPanelPlacements,
    visiblePlacements,
    leadingItems,
    panelRegion,
    eligibleSubPanels,
    showTabs,
    hasActions,
  } = useWorkbenchRegionTabsState(workbench, region, visibilityStorageKey);
  const tabOverrides = tabStore.tabOverrides;
  const getKey = (placement: WorkbenchWidgetPlacement) => toTabKey(region, placement);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
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
    (placement) => resolvePlacementIcon(workbench, placement),
  );
  const hasVisibilityMenu = menuActions.length > 0;
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
  if (!showTabs && !hasActions) return null;
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
  ));
  if (!showTabs) {
    return (
      <HStack flex="1 1 auto" h="full" minW="0" gap="2xs">
        {panelRegion ? (
          <WorkbenchPanelAddMenu
            workbench={workbench}
            region={panelRegion}
            resource={resource}
            panels={eligibleSubPanels}
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
          disabled={false}
          workbench={workbench}
          placements={visiblePlacements}
          activeWidgetId={activeWidgetId}
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
