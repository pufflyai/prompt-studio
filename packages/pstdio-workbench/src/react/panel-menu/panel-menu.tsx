import { Box, HStack, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { AttachedMenu, Header, PANEL_HEADER_CONTROL_SIZE, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  getActiveWorkbenchLocationPanel,
  getActiveWorkbenchSubPanel,
  matchesWorkbenchLocationEligibility,
  matchesWorkbenchModeEligibility,
  matchesWorkbenchPanelMenuOwner,
  type WorkbenchCore,
  type WorkbenchPanelMenuRegion,
  type WorkbenchPanelMenuSide,
  type WorkbenchPanelRegion,
  type WorkbenchRegionSize,
  workbenchPanelMenuRegions,
} from "../../core";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { resolvePanelCollapsible } from "../workbench/workbench-panel-state";
import {
  canAttachWorkbenchPanelMenu,
  PANEL_CONTENT_MIN_SIZE_PX,
  PANEL_MENU_RESIZE_HANDLE_SIZE_PX,
  shouldCollapseWorkbenchPanelMenus,
} from "./panel-menu-sizing";

const PANEL_MENU_SIZE = { defaultPx: 180, minPx: 144, maxPx: 320 };

const panelLabels: Record<WorkbenchPanelRegion, string> = {
  main: "Main",
  secondary: "Secondary",
  side: "Side",
};

const resolveRegionSize = (regionSize: WorkbenchRegionSize | undefined) => ({
  defaultPx: regionSize?.defaultPx ?? PANEL_MENU_SIZE.defaultPx,
  minPx: regionSize?.minPx ?? PANEL_MENU_SIZE.minPx,
  maxPx: regionSize ? regionSize.maxPx : PANEL_MENU_SIZE.maxPx,
});

export const getWorkbenchPanelMenuLabel = (panel: WorkbenchPanelRegion, side: WorkbenchPanelMenuSide) =>
  `${panelLabels[panel]} ${side} menu`;

interface WorkbenchPanelMenuView {
  region: WorkbenchPanelMenuRegion;
  side: WorkbenchPanelMenuSide;
  label: string;
  title: string;
  icon: string;
  has: boolean;
  collapsed: boolean;
  responsiveCollapsed: boolean;
  collapsible: boolean;
  size: ReturnType<typeof resolveRegionSize>;
  onOpen: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
}

const useWorkbenchPanelMenu = (
  workbench: WorkbenchCore,
  panel: WorkbenchPanelRegion,
  side: WorkbenchPanelMenuSide,
  responsiveCollapsed = false,
): WorkbenchPanelMenuView => {
  const region = workbenchPanelMenuRegions[panel][side];
  const locationResource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const registeredWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.widgets);
  const currentRegionState = layout.regions[region];
  const activeSubPanel = getActiveWorkbenchSubPanel(layout, panel, locationResource, {
    ignoreOwnerResourceUri: panel === "side",
  });
  const activeLocationPanel = getActiveWorkbenchLocationPanel(layout);
  const regionState = {
    ...currentRegionState,
    widgets: currentRegionState.widgets.filter((placement) => {
      const contribution = registeredWidgets[placement.contributionId];
      return contribution
        ? (panel === "side"
            ? matchesWorkbenchModeEligibility(contribution, modeId)
            : matchesWorkbenchLocationEligibility(contribution, locationResource, modeId, placement)) &&
            matchesWorkbenchPanelMenuOwner(contribution, {
              locationPanel: activeLocationPanel,
              subPanel: activeSubPanel,
            })
        : false;
    }),
  };
  const activePlacement =
    regionState.widgets.find((placement) => placement.widgetId === regionState.activeWidgetId) ??
    regionState.widgets[0];
  const widget = activePlacement ? registeredWidgets[activePlacement.contributionId] : undefined;
  const collapsible = useWorkbenchStore(workbench.layout.store, () => resolvePanelCollapsible(workbench, region));
  const panelStateKey = activePlacement ? `panel-menu:${activePlacement.widgetId}` : region;
  const open = useWorkbenchStore(workbench.panels.store, (state) => state.openByRegionId[panelStateKey] ?? true);

  return {
    region,
    side,
    label: getWorkbenchPanelMenuLabel(panel, side),
    title: widget?.title ?? getWorkbenchPanelMenuLabel(panel, side),
    icon: widget?.icon ?? (side === "left" ? "PanelLeft" : "PanelRight"),
    has: regionState.widgets.length > 0 || Boolean(workbench.layout.getPlaceholder(region)),
    collapsed: (!open || responsiveCollapsed) && collapsible,
    responsiveCollapsed,
    collapsible,
    size: resolveRegionSize(workbench.layout.getRegionSize(region)),
    onOpen: () => workbench.panels.setOpen(panelStateKey, true),
    onCollapsedChange: (collapsed) => {
      if (!collapsed || collapsible) workbench.panels.setOpen(panelStateKey, !collapsed);
    },
  };
};

const WorkbenchPanelMenu = (props: { workbench: WorkbenchCore; view: WorkbenchPanelMenuView }) => {
  const { view, workbench } = props;
  const panel = view.region.split("-")[0] as WorkbenchPanelRegion;
  const background = panel === "side" ? workbenchBackgrounds.widget : workbenchBackgrounds.panel;

  return (
    <AttachedMenu
      data-workbench-panel-menu={`${panel}-${view.side}`}
      data-workbench-region={view.region}
      bg={background}
    >
      <WorkbenchRegion workbench={workbench} region={view.region} title={view.label} transparent />
    </AttachedMenu>
  );
};

const addPanelMenu = (input: { content: ReactNode; view: WorkbenchPanelMenuView; workbench: WorkbenchCore }) => {
  const { content, view, workbench } = input;
  if (!view.has) return content;

  return (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide={view.side}
      resizablePanel={<WorkbenchPanelMenu workbench={workbench} view={view} />}
      contentPanel={content}
      collapsed={view.collapsed}
      collapsible={view.collapsible}
      defaultSizePx={view.size.defaultPx}
      minSizePx={view.size.minPx}
      maxSizePx={view.size.maxPx}
      contentMinSizePx={PANEL_CONTENT_MIN_SIZE_PX}
      resizeHandleSizePx={PANEL_MENU_RESIZE_HANDLE_SIZE_PX}
      resizeLabel={`Resize ${view.label}`}
      showResizeSeparator
      onSizeChange={(width) => workbench.layout.setRegionSize(view.region, width)}
      onCollapsedChange={view.onCollapsedChange}
    />
  );
};

export const WorkbenchPanelMenuLayout = (props: {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelRegion;
  children: ReactNode;
}) => {
  const { children, panel, workbench } = props;
  const panelWidth = useWorkbenchPanelWidth(panel);
  const responsiveCollapsed = shouldCollapseWorkbenchPanelMenus(panelWidth);
  const left = useWorkbenchPanelMenu(workbench, panel, "left", responsiveCollapsed);
  const right = useWorkbenchPanelMenu(workbench, panel, "right", responsiveCollapsed);
  const withRight = addPanelMenu({ content: children, view: right, workbench });
  return addPanelMenu({ content: withRight, view: left, workbench });
};

const useWorkbenchPanelWidth = (panel: WorkbenchPanelRegion) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = document.querySelector<HTMLElement>(`[data-workbench-panel="${panel}"]`);
    if (!element) return;

    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [panel]);

  return width;
};

interface WorkbenchPanelMenuOpenerProps {
  view: WorkbenchPanelMenuView;
  workbench: WorkbenchCore;
  canAttach: boolean;
}

const WorkbenchPanelMenuOpener = (props: WorkbenchPanelMenuOpenerProps) => {
  const { canAttach, view, workbench } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Menu.Root
      positioning={{ placement: "bottom-start", offset: { mainAxis: 0 }, getAnchorElement: () => triggerRef.current }}
      onExitComplete={() => triggerRef.current?.focus()}
    >
      <Tooltip content={view.title}>
        <Menu.Trigger asChild>
          <IconButton
            ref={triggerRef}
            variant="ghost"
            size={PANEL_HEADER_CONTROL_SIZE}
            aria-label={`Open ${view.label}`}
            flexShrink={0}
          >
            <WorkbenchIcon name={view.icon} size={14} />
          </IconButton>
        </Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            aria-label={`${view.label} controls`}
            data-workbench-panel-menu-controls={view.region}
            boxShadow="none"
            display="flex"
            flexDirection="column"
            h="64"
            maxW="64"
            minW="64"
            overflow="hidden"
            p="0"
            w="64"
          >
            <Header variant="narrow" borderBottomWidth="1px" borderColor="border.subtle" flexShrink={0} gap="xs">
              <WorkbenchIcon name={view.icon} size={14} />
              <Text flex="1" minW="0" textStyle="label/S/medium" truncate>
                {view.title}
              </Text>
              <Tooltip content={canAttach ? `Attach ${view.label}` : "Panel is too narrow to attach this menu"}>
                <Box as="span" display="inline-flex">
                  <IconButton
                    variant="ghost"
                    size="xs"
                    aria-label={`Attach ${view.label}`}
                    disabled={!canAttach}
                    onClick={view.onOpen}
                  >
                    <WorkbenchIcon name={view.side === "left" ? "PanelLeft" : "PanelRight"} size={14} />
                  </IconButton>
                </Box>
              </Tooltip>
            </Header>
            <Box flex="1" minH="0" minW="0">
              <WorkbenchRegion workbench={workbench} region={view.region} title={view.label} transparent />
            </Box>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export const WorkbenchPanelMenuOpeners = (props: { workbench: WorkbenchCore; panel: WorkbenchPanelRegion }) => {
  const { panel, workbench } = props;
  const panelWidth = useWorkbenchPanelWidth(panel);
  const responsiveCollapsed = shouldCollapseWorkbenchPanelMenus(panelWidth);
  const left = useWorkbenchPanelMenu(workbench, panel, "left", responsiveCollapsed);
  const right = useWorkbenchPanelMenu(workbench, panel, "right", responsiveCollapsed);
  const views = [left, right];
  const closedMenus = [left, right].filter((view) => view.has && view.collapsed);

  if (closedMenus.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {closedMenus.map((view) => {
        const attachedMenuMinSizes = views
          .filter((candidate) => candidate.has && !candidate.collapsed)
          .map((candidate) => candidate.size.minPx);
        const canAttach =
          !view.responsiveCollapsed &&
          canAttachWorkbenchPanelMenu({
            panelWidth,
            targetMenuMinSize: view.size.minPx,
            attachedMenuMinSizes,
          });

        return <WorkbenchPanelMenuOpener key={view.region} view={view} workbench={workbench} canAttach={canAttach} />;
      })}
    </HStack>
  );
};
