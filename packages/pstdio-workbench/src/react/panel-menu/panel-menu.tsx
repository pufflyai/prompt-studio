import { AttachedMenu, ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchMenuHeaderLayout } from "../header/menu-header-layout";
import { WorkbenchPanelMenuSlot } from "./panel-menu-hosts";
import { PANEL_CONTENT_MIN_SIZE_PX } from "./panel-menu-sizing";
import { useWorkbenchPanelMenus, type WorkbenchPanelMenuView } from "./use-panel-menu";

const WorkbenchPanelMenu = (props: { view: WorkbenchPanelMenuView }) => (
  <AttachedMenu data-workbench-panel-menu={props.view.region}>
    <WorkbenchPanelMenuSlot
      region={props.view.region}
      presentation="attached"
      active={props.view.has && !props.view.collapsed && Boolean(props.view.canAttach)}
    />
  </AttachedMenu>
);
const MenuSplit = (props: { workbench: WorkbenchCore; view: WorkbenchPanelMenuView; children: ReactNode }) => {
  const { workbench, view, children } = props;
  return (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide={view.side}
      resizablePanel={<WorkbenchPanelMenu view={view} />}
      contentPanel={children}
      collapsed={!view.has || view.collapsed || !view.canAttach}
      collapsible={view.collapsible}
      defaultSizePx={view.size.defaultPx}
      minSizePx={view.size.minPx}
      maxSizePx={view.size.maxPx}
      contentMinSizePx={PANEL_CONTENT_MIN_SIZE_PX}
      resizeLabel={`Resize ${view.title}`}
      separator="line"
      onSizeChange={(size) => workbench.layout.setRegionSize(view.region, size)}
      onCollapsedChange={view.onCollapsedChange}
    />
  );
};
export const WorkbenchPanelMenuLayout = (props: {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelRegion;
  children: ReactNode;
}) => {
  const { workbench, panel, children } = props;
  const [left, right, bottom] = useWorkbenchPanelMenus(workbench, panel);
  return (
    <WorkbenchMenuHeaderLayout workbench={workbench} panel={panel}>
      <MenuSplit workbench={workbench} view={left!}>
        <MenuSplit workbench={workbench} view={right!}>
          <MenuSplit workbench={workbench} view={bottom!}>
            {children}
          </MenuSplit>
        </MenuSplit>
      </MenuSplit>
    </WorkbenchMenuHeaderLayout>
  );
};
