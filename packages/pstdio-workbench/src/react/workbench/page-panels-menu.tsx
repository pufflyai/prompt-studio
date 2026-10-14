import { IconButton, Menu, Portal } from "@chakra-ui/react";
import { ListRow, PANEL_HEADER_CONTROL_SIZE, Tooltip } from "@pstdio/ui";
import { useRef } from "react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchPanelMenus } from "../panel-menu/use-panel-menu";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";

const PagePanelAction = (props: { value: string; label: string; icon: string; onActivate(): void }) => {
  const { value, label, icon, onActivate } = props;
  return (
    <Menu.Item value={value} asChild>
      <ListRow
        asChild
        variant="full-width"
        label={label}
        icon={<WorkbenchIcon name={icon} size={14} />}
        onActivate={onActivate}
      />
    </Menu.Item>
  );
};

export const PagePanelsMenu = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const page = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );
  const menus = useWorkbenchPanelMenus(workbench, "main").filter((menu) => menu.has && page?.panelMenus?.[menu.side]);
  const bottom = usePanelPolicy(workbench, "bottom");
  const aside = usePanelPolicy(workbench, "aside");
  const geometry = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions);
  if (!page) return null;
  return (
    <Menu.Root positioning={{ placement: "bottom-end", getAnchorElement: () => triggerRef.current }}>
      <Tooltip content="Page panels">
        <Menu.Trigger asChild>
          <IconButton ref={triggerRef} variant="ghost" size={PANEL_HEADER_CONTROL_SIZE} aria-label="Page panels">
            <WorkbenchIcon name="panels-right-bottom" size={14} />
          </IconButton>
        </Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content aria-label="Page panels">
            {menus
              .filter((menu) => menu.collapsible)
              .map((menu) => (
                <PagePanelAction
                  key={menu.region}
                  value={menu.region}
                  label={`${menu.collapsed ? "Show" : "Hide"} ${menu.title}`}
                  icon={menu.side === "left" ? "PanelLeft" : "PanelRight"}
                  onActivate={() => menu.onCollapsedChange(!menu.collapsed)}
                />
              ))}
            {aside.provided && (aside.open ? aside.canClose : aside.canOpen) ? (
              <PagePanelAction
                value="aside-visibility"
                label={`${aside.open ? "Hide" : "Show"} Side panel`}
                icon={geometry.aside.edge === "left" ? "PanelLeft" : "PanelRight"}
                onActivate={() => {
                  void workbench.shell.setRegionOpen("aside", !aside.open);
                }}
              />
            ) : null}
            {bottom.provided && (bottom.open ? bottom.canClose : bottom.canOpen) ? (
              <PagePanelAction
                value="bottom-visibility"
                label={`${bottom.open ? "Hide" : "Show"} Page bottom`}
                icon={geometry.bottom.edge === "top" ? "PanelTop" : "PanelBottom"}
                onActivate={() => {
                  void workbench.shell.setRegionOpen("bottom", !bottom.open);
                }}
              />
            ) : null}
            <Menu.Separator />
            <PagePanelAction
              value="reset-layout"
              label="Reset layout"
              icon="RotateCcw"
              onActivate={() => workbench.resetLayout()}
            />
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
