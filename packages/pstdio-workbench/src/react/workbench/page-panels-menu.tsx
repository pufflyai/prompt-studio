import { IconButton, Menu, Portal } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { useRef } from "react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchPanelMenus } from "../panel-menu/use-panel-menu";
import { openPanelWidget } from "../region/panel-widget-open";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchCompositionPanels } from "../shared/use-workbench-composition-panels";
import { useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const PagePanelsMenu = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const page = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );
  const menus = useWorkbenchPanelMenus(workbench, "main").filter((menu) => menu.has && page?.panelMenus?.[menu.side]);
  const panels = useWorkbenchCompositionPanels(workbench).bottom.addable;
  const resource = useWorkbenchLocationResource(workbench);
  const bottom = usePanelPolicy(workbench, "bottom");
  const aside = usePanelPolicy(workbench, "aside");
  if (!page) return null;
  return (
    <Menu.Root positioning={{ placement: "bottom-end", getAnchorElement: () => triggerRef.current }}>
      <Tooltip content="Page panels">
        <Menu.Trigger asChild>
          <IconButton ref={triggerRef} variant="ghost" size={PANEL_HEADER_CONTROL_SIZE} aria-label="Page panels">
            <WorkbenchIcon name="PanelsTopLeft" size={14} />
          </IconButton>
        </Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label="Page panels">
            {menus
              .filter((menu) => menu.collapsible)
              .map((menu) => (
                <Menu.Item
                  key={menu.region}
                  value={menu.region}
                  onClick={() => menu.onCollapsedChange(!menu.collapsed)}
                >
                  {menu.collapsed ? "Show" : "Hide"} {menu.title}
                </Menu.Item>
              ))}
            {panels.map((panel) => (
              <Menu.Item
                key={panel.panelId}
                value={panel.panelId}
                onClick={() =>
                  openPanelWidget({
                    workbench,
                    widget: panel.contribution,
                    region: "bottom",
                    resource,
                    pinned: panel.pinned,
                    open: panel.open,
                  })
                }
              >
                Open {panel.contribution.title}
              </Menu.Item>
            ))}
            {aside.provided && (aside.open ? aside.canClose : aside.canOpen) ? (
              <Menu.Item
                value="aside-visibility"
                onClick={() => {
                  void workbench.shell.setRegionOpen("aside", !aside.open);
                }}
              >
                {aside.open ? "Hide" : "Show"} Side panel
              </Menu.Item>
            ) : null}
            {bottom.provided && (bottom.open ? bottom.canClose : bottom.canOpen) ? (
              <Menu.Item
                value="bottom-visibility"
                onClick={() => {
                  void workbench.shell.setRegionOpen("bottom", !bottom.open);
                }}
              >
                {bottom.open ? "Hide" : "Show"} Page bottom
              </Menu.Item>
            ) : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
