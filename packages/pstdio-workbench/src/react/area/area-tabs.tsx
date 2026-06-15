import { CloseButton, Menu, Portal, Tabs, Text } from "@chakra-ui/react";
import {
  buildTabVisibilityMenuActions,
  filterVisibleTabs,
  ListRow,
  ScrollArea,
  useTabVisibilityStore,
} from "@pstdio/ui";
import { Check } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useState } from "react";
import type { WorkbenchArea as WorkbenchAreaId, WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { getWorkbenchAreaBackground } from "../theme/workbench-theme-background";
import { resolveDisplayedActiveWidgetId, toTabKey } from "./area-tabs-visibility";

interface WorkbenchAreaTabsProps {
  workbench: WorkbenchCore;
  area: WorkbenchAreaId;
  visibilityStorageKey?: string;
}

const isPlacementCloseable = (placement: WorkbenchWidgetPlacement) => placement.closable === true;

export const shouldShowAreaTabs = (placements: WorkbenchWidgetPlacement[]) =>
  placements.length > 1 || placements.some(isPlacementCloseable);

export const WorkbenchAreaTabs = (props: WorkbenchAreaTabsProps) => {
  const { workbench, area, visibilityStorageKey } = props;
  const areaState = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas[area]);
  const placements = areaState.widgets;
  // Visibility is on by default; the host can override the storage key. When no key is supplied, fall
  // back to the area id so persistence has a sensible default.
  const visibilityKey = visibilityStorageKey ?? area;
  const tabStore = useTabVisibilityStore(visibilityKey, (state) => state);
  const tabOverrides = tabStore.tabOverrides;
  const getKey = (placement: WorkbenchWidgetPlacement) => toTabKey(area, placement);
  const visiblePlacements = filterVisibleTabs(placements, tabOverrides, getKey);
  const showTabs = shouldShowAreaTabs(visiblePlacements);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });

  const openVisibilityMenu = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    setAnchor({ x: event.clientX, y: event.clientY });
    setMenuOpen(true);
  };

  const menuActions = buildTabVisibilityMenuActions(
    placements,
    tabOverrides,
    {
      onToggleTab: (key, hiddenByDefault) => tabStore.toggleTab(key, hiddenByDefault),
      onResetAll: () => tabStore.reset(),
    },
    getKey,
    { checkmark: <Check size={14} /> },
  );

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

  const activeWidgetId = resolveDisplayedActiveWidgetId(visiblePlacements, areaState.activeWidgetId);
  // The active tab paints over the header's bottom line, so it has to match the
  // panel content background to read as a seamless connection.
  const activeBackground = getWorkbenchAreaBackground(area);

  return (
    <Tabs.Root
      value={activeWidgetId}
      onValueChange={(details) => workbench.layout.activateWidget(details.value)}
      variant="outline"
      colorPalette="gray"
      justify="start"
      size="sm"
      alignSelf="stretch"
      flex="0 1 auto"
      maxW="full"
      minW="0"
      h="full"
      position="relative"
      zIndex="1"
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
        <Tabs.List
          h="full"
          minW="max-content"
          alignItems="stretch"
          justifyContent="flex-start"
          onContextMenu={openVisibilityMenu}
        >
          {visiblePlacements.map((placement) => {
            const closable = isPlacementCloseable(placement);
            const isActive = placement.widgetId === activeWidgetId;
            const label = placement.title ?? placement.contributionId;
            const icon =
              placement.resource?.icon ??
              (placement.resource ? workbench.resources.getKind(placement.resource.kind)?.icon : undefined);

            return (
              <Tabs.Trigger
                key={placement.widgetId}
                value={placement.widgetId}
                h="full"
                maxW="12rem"
                minW="0"
                flexShrink={0}
                gap="2xs"
                px="sm"
                py="0"
                textStyle="label/XS/medium"
                title={label}
                className="group"
                _selected={{ bg: activeBackground }}
                _hover={isActive ? undefined : { bg: "bg.hover", color: "fg" }}
                onContextMenu={!closable ? openVisibilityMenu : undefined}
              >
                {icon ? <WorkbenchIcon name={icon} size={14} flexShrink={0} color="fg.muted" /> : null}
                <Text as="span" minW="0" truncate>
                  {label}
                </Text>
                {closable ? (
                  <CloseButton
                    as="span"
                    role="button"
                    aria-label={`Close ${label}`}
                    size="2xs"
                    flexShrink={0}
                    me="-2"
                    opacity={isActive ? "1" : "0"}
                    pointerEvents={isActive ? "auto" : "none"}
                    _groupHover={{ opacity: "1", pointerEvents: "auto" }}
                    _groupFocusWithin={{ opacity: "1", pointerEvents: "auto" }}
                    transition="opacity 120ms ease"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      workbench.layout.closeWidget(placement.widgetId);
                    }}
                  />
                ) : null}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
      </ScrollArea>
      <Menu.Root
        open={menuOpen}
        onOpenChange={(details) => setMenuOpen(details.open)}
        positioning={{
          placement: "bottom-start",
          getAnchorRect: () => ({ x: anchor.x, y: anchor.y, width: 0, height: 0 }),
        }}
      >
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="220px" bg="bg">
              {menuActions.map((action) => (
                <Menu.Item key={action.key} value={action.key} asChild>
                  <ListRow
                    asChild
                    variant="compact"
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
    </Tabs.Root>
  );
};
