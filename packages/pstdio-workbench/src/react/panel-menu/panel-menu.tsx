import { HStack, IconButton, Menu, Portal } from "@chakra-ui/react";
import { AttachedMenu, PANEL_HEADER_CONTROL_SIZE, ResizableSplitLayout, Tooltip } from "@pstdio/ui";
import type { ReactNode } from "react";
import {
  type WorkbenchCore,
  type WorkbenchPanelMenuRegion,
  type WorkbenchPanelMenuSide,
  type WorkbenchPanelRegion,
  type WorkbenchRegionSize,
  workbenchPanelMenuRegions,
} from "../../core";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { resolvePanelCollapsible, setWorkbenchPanelOpen } from "../workbench/workbench-panel-state";

const PANEL_MENU_SIZE = { defaultPx: 180, minPx: 144, maxPx: 320 };
const PANEL_CONTENT_MIN_SIZE_PX = 120;
const PANEL_MENU_RESIZE_HANDLE_SIZE_PX = 4;

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
  icon: string;
  has: boolean;
  collapsed: boolean;
  collapsible: boolean;
  size: ReturnType<typeof resolveRegionSize>;
  onOpen: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
}

const useWorkbenchPanelMenu = (
  workbench: WorkbenchCore,
  panel: WorkbenchPanelRegion,
  side: WorkbenchPanelMenuSide,
): WorkbenchPanelMenuView => {
  const region = workbenchPanelMenuRegions[panel][side];
  const regionState = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions[region]);
  const widget = useWorkbenchStore(workbench.layout.store, (state) => {
    const activePlacement =
      regionState.widgets.find((placement) => placement.widgetId === regionState.activeWidgetId) ??
      regionState.widgets[0];
    return activePlacement ? state.widgets[activePlacement.contributionId] : undefined;
  });
  const collapsible = useWorkbenchStore(workbench.layout.store, () => resolvePanelCollapsible(workbench, region));
  const open = useWorkbenchStore(workbench.panels.store, (state) => state.openByRegionId[region] ?? true);

  return {
    region,
    side,
    label: getWorkbenchPanelMenuLabel(panel, side),
    icon: widget?.icon ?? (side === "left" ? "PanelLeft" : "PanelRight"),
    has: regionState.widgets.length > 0 || Boolean(workbench.layout.getPlaceholder(region)),
    collapsed: !open && collapsible,
    collapsible,
    size: resolveRegionSize(workbench.layout.getRegionSize(region)),
    onOpen: () => setWorkbenchPanelOpen(workbench, region, true),
    onCollapsedChange: (collapsed) => {
      if (!collapsed || collapsible) setWorkbenchPanelOpen(workbench, region, !collapsed);
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
  const left = useWorkbenchPanelMenu(workbench, panel, "left");
  const right = useWorkbenchPanelMenu(workbench, panel, "right");
  const withRight = addPanelMenu({ content: children, view: right, workbench });
  return addPanelMenu({ content: withRight, view: left, workbench });
};

const WorkbenchPanelMenuOpener = (props: { view: WorkbenchPanelMenuView }) => {
  const { view } = props;

  return (
    <Menu.Root positioning={{ placement: "bottom-start", offset: { mainAxis: 0 } }}>
      <Menu.Trigger asChild>
        <IconButton variant="ghost" size={PANEL_HEADER_CONTROL_SIZE} aria-label={`Open ${view.label}`} flexShrink={0}>
          <WorkbenchIcon name={view.icon} size={14} />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            aria-label={`${view.label} controls`}
            data-workbench-panel-menu-controls={view.region}
            boxShadow="none"
            p="2xs"
            minW="auto"
          >
            <Tooltip content={`Attach ${view.label}`}>
              <IconButton variant="ghost" size="xs" aria-label={`Attach ${view.label}`} onClick={view.onOpen}>
                <WorkbenchIcon name={view.icon} size={14} />
              </IconButton>
            </Tooltip>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export const WorkbenchPanelMenuOpeners = (props: { workbench: WorkbenchCore; panel: WorkbenchPanelRegion }) => {
  const { panel, workbench } = props;
  const left = useWorkbenchPanelMenu(workbench, panel, "left");
  const right = useWorkbenchPanelMenu(workbench, panel, "right");
  const closedMenus = [left, right].filter((view) => view.has && view.collapsed);

  if (closedMenus.length === 0) return null;

  return (
    <HStack flexShrink={0} gap="2xs" minW="0">
      {closedMenus.map((view) => (
        <WorkbenchPanelMenuOpener key={view.region} view={view} />
      ))}
    </HStack>
  );
};
