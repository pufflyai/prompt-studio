import { HStack, Tabs } from "@chakra-ui/react";
import { buildTabVisibilityMenuActions, filterVisibleTabs, ScrollArea, useTabVisibilityStore } from "@pstdio/ui";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useState } from "react";
import type { SlotId, WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { AreaTabMenuToggles } from "./area-tab-menu-toggles";
import { AreaTabTrigger, isPlacementCloseable } from "./area-tab-trigger";
import { AreaTabsAddMenu } from "./area-tabs-add-menu";
import { AreaTabsContextMenu } from "./area-tabs-context-menu";
import { resolveDisplayedActiveWidgetId, toTabKey } from "./area-tabs-visibility";
import { useAreaLeadingItems } from "./use-area-leading-items";
import { type PanelMenusResult, usePanelMenus } from "./use-panel-menus";

interface WorkbenchAreaTabsProps {
  workbench: WorkbenchCore;
  area: SlotId;
  visibilityStorageKey?: string;
  forceVisible?: boolean;
  showAddMenu?: boolean;
}

interface WorkbenchAreaTabsContentProps extends WorkbenchAreaTabsProps {
  panelMenus: PanelMenusResult;
}

export const shouldShowAreaTabs = (
  placements: WorkbenchWidgetPlacement[],
  options: { hasLeadingActions?: boolean; hasOpenablePanels?: boolean; hasPanelMenuToggles?: boolean } = {},
) =>
  options.hasLeadingActions === true ||
  options.hasOpenablePanels === true ||
  options.hasPanelMenuToggles === true ||
  placements.length > 1 ||
  placements.some(isPlacementCloseable);

const WorkbenchAreaTabsContent = (props: WorkbenchAreaTabsContentProps) => {
  const { workbench, area, visibilityStorageKey, panelMenus, forceVisible = false, showAddMenu = false } = props;
  const areaState = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas[area]);
  const leading = useAreaLeadingItems(workbench, area);
  const placements = panelMenus.tabs;
  // Visibility is on by default; the host can override the storage key. When no key is supplied, fall
  // back to the area id so persistence has a sensible default.
  const visibilityKey = visibilityStorageKey ?? area;
  const tabStore = useTabVisibilityStore(visibilityKey, (state) => state);
  const tabOverrides = tabStore.tabOverrides;
  const getKey = (placement: WorkbenchWidgetPlacement) => toTabKey(area, placement);
  const visiblePlacements = filterVisibleTabs(placements, tabOverrides, getKey);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [contextPlacement, setContextPlacement] = useState<WorkbenchWidgetPlacement>();

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
  const hasMoveMenu = placements.length > 1;
  const hasContextMenu = hasVisibilityMenu || hasMoveMenu;
  const showTabs =
    forceVisible ||
    shouldShowAreaTabs(visiblePlacements, {
      hasLeadingActions: leading.items.length > 0,
      hasOpenablePanels: leading.openablePanels.length > 0,
      hasPanelMenuToggles: panelMenus.toggles.length > 0,
    });

  const openContextMenu = (event: ReactMouseEvent<HTMLElement>, placement?: WorkbenchWidgetPlacement) => {
    if (!hasVisibilityMenu && (!placement || !hasMoveMenu)) return;

    event.preventDefault();
    event.stopPropagation();
    setAnchor({ x: event.clientX, y: event.clientY });
    setContextPlacement(placement);
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

  const activeWidgetId = resolveDisplayedActiveWidgetId(visiblePlacements, areaState?.activeWidgetId);
  return (
    <HStack alignSelf="stretch" flex="1 1 auto" maxW="full" minW="0" h="full" gap="0" position="relative" zIndex="1">
      <Tabs.Root
        value={activeWidgetId}
        onValueChange={(details) => workbench.layout.activateWidget(details.value)}
        variant="subtle"
        colorPalette="gray"
        justify="start"
        size="sm"
        flex="1 1 auto"
        h="full"
        maxW="full"
        minW="0"
        position="relative"
        onContextMenu={hasVisibilityMenu ? (event) => openContextMenu(event) : undefined}
      >
        {/* Overflowing tabs scroll horizontally; the overlay scrollbar adds no
            height so the active tab still meets the header's bottom edge. */}
        <ScrollArea
          viewportRef={setViewport}
          flex="1 1 auto"
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
              <AreaTabTrigger
                key={placement.widgetId}
                workbench={workbench}
                placement={placement}
                activeWidgetId={activeWidgetId}
                onContextMenu={hasContextMenu ? (event) => openContextMenu(event, placement) : undefined}
              />
            ))}
            <AreaTabsAddMenu
              workbench={workbench}
              area={area}
              items={leading.items}
              openablePanels={leading.openablePanels}
              primary={leading.primary}
              showWhenEmpty={showAddMenu}
            />
          </Tabs.List>
        </ScrollArea>
        {hasContextMenu ? (
          <AreaTabsContextMenu
            workbench={workbench}
            area={area}
            open={menuOpen}
            onOpenChange={(open) => {
              setMenuOpen(open);
              if (!open) setContextPlacement(undefined);
            }}
            anchor={anchor}
            placement={contextPlacement}
            placements={placements}
            visiblePlacements={visiblePlacements}
            visibilityActions={menuActions}
          />
        ) : null}
      </Tabs.Root>
      <AreaTabMenuToggles workbench={workbench} menus={panelMenus.toggles} dockable={panelMenus.dockable} />
    </HStack>
  );
};

export const WorkbenchAreaTabs = (props: WorkbenchAreaTabsProps) => {
  const panelMenus = usePanelMenus(props.workbench, props.area);
  return <WorkbenchAreaTabsContent {...props} panelMenus={panelMenus} />;
};

export const WorkbenchAreaTabsWithMenus = (props: WorkbenchAreaTabsContentProps) => (
  <WorkbenchAreaTabsContent {...props} />
);
