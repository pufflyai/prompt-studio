import { IconButton, Menu, Portal } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import type { WorkbenchCore } from "../../core";
import { pageTitle } from "../../core/controllers/page-location/page-breadcrumbs";
import { runUserAction } from "../../core/shared/run-user-action";
import { WorkbenchPanelMenuPeek } from "../panel-menu/panel-menu";
import { useWorkbenchPanelMenus } from "../panel-menu/use-panel-menu";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const PagePanelsMenu = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [peekMenuId, setPeekMenuId] = useState<string>();
  const page = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );
  const menus = useWorkbenchPanelMenus(workbench, "main").filter((menu) => menu.has);
  const bottom = usePanelPolicy(workbench, "bottom");
  const aside = usePanelPolicy(workbench, "aside");
  const geometry = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions);
  const peekMenu = menus.find((menu) => menu.menuId === peekMenuId && !menu.canAttach);
  useEffect(() => {
    if (peekMenuId && !peekMenu) setPeekMenuId(undefined);
  }, [peekMenuId, peekMenu]);
  if (!page && !menus.length) return null;
  const label = `${page ? pageTitle(page) : "Editor"} panels`;
  const panels = [
    {
      region: "bottom",
      label: "Bottom panel",
      policy: bottom,
      icon: geometry.bottom.edge === "top" ? "PanelTop" : "PanelBottom",
    },
    {
      region: "aside",
      label: "Side panel",
      policy: aside,
      icon: geometry.aside.edge === "left" ? "PanelLeft" : "PanelRight",
    },
  ] as const;
  return (
    <>
      <Menu.Root positioning={{ placement: "bottom-end", getAnchorElement: () => triggerRef.current }}>
        <Tooltip content={label} openDelay={300} closeDelay={150}>
          <Menu.Trigger asChild>
            <IconButton ref={triggerRef} variant="ghost" size={PANEL_HEADER_CONTROL_SIZE} aria-label={label}>
              <WorkbenchIcon name="PanelsRightBottom" size={14} />
            </IconButton>
          </Menu.Trigger>
        </Tooltip>
        <Portal>
          <Menu.Positioner>
            <Menu.Content aria-label={label}>
              {(page ? panels : []).map(({ region, label, policy, icon }) => (
                <Menu.CheckboxItem
                  key={region}
                  value={region}
                  checked={policy.open}
                  disabled={!policy.provided || !(policy.open ? policy.canClose : policy.canOpen)}
                  onCheckedChange={(checked) =>
                    void runUserAction(workbench, label, () => workbench.shell.setRegionOpen(region, checked))
                  }
                >
                  <WorkbenchIcon name={icon} size={14} />
                  <Menu.ItemText>{label}</Menu.ItemText>
                  <Menu.ItemIndicator />
                </Menu.CheckboxItem>
              ))}
              {menus.map((menu) => (
                <Menu.CheckboxItem
                  key={menu.region}
                  value={menu.region}
                  checked={!menu.collapsed}
                  disabled={menu.canAttach && !menu.collapsible}
                  onCheckedChange={(checked) => {
                    if (checked && !menu.canAttach) setPeekMenuId(menu.menuId);
                    else menu.onCollapsedChange(!checked);
                  }}
                >
                  <WorkbenchIcon name={menu.side === "left" ? "PanelLeft" : "PanelRight"} size={14} />
                  <Menu.ItemText>{menu.title}</Menu.ItemText>
                  <Menu.ItemIndicator />
                </Menu.CheckboxItem>
              ))}
              <Menu.Separator />
              <Menu.Item
                value="reset-layout"
                onClick={() =>
                  void runUserAction(workbench, "Reset layout", () =>
                    workbench.commands.executeCommand("workbench.resetLayout"),
                  )
                }
              >
                <WorkbenchIcon name="RotateCcw" size={14} />
                Reset layout
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
      <WorkbenchPanelMenuPeek
        workbench={workbench}
        view={peekMenu}
        anchor={() => triggerRef.current}
        onClose={() => setPeekMenuId(undefined)}
      />
    </>
  );
};
