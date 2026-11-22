import type { ComponentProps } from "react";
import type { WorkbenchPanelRegion } from "../../core";
import { WorkbenchPanelMenuButton } from "../panel-menu/panel-menu-button";
import type { PanelMenuEntry } from "../panel-menu/panel-menu-entries";
import type { WorkbenchPanelMenuView } from "../panel-menu/use-panel-menu";
import { WorkbenchHeaderActions } from "./header-actions";
import { WorkbenchHeaderContribution } from "./header-contribution";

type Props = ComponentProps<typeof WorkbenchHeaderActions> & {
  panel: WorkbenchPanelRegion;
  id: string;
  menu?: PanelMenuEntry;
  menuView?: WorkbenchPanelMenuView;
  vertical: boolean;
  compact?: boolean;
  orderKey: string;
  overflowIds: string[];
};
export const WorkbenchMenuHeaderControl = (props: Props) => {
  const { panel, id, menu, menuView, vertical, compact, orderKey, overflowIds, ...actions } = props;
  if (menu && menuView)
    return <WorkbenchPanelMenuButton workbench={props.workbench} panel={panel} entry={menu} view={menuView} />;
  if (id === "contribution") return <WorkbenchHeaderContribution key={orderKey} panel={panel} vertical={vertical} />;
  return (
    <WorkbenchHeaderActions
      {...actions}
      iconOnly={vertical || compact}
      itemIds={id === "overflow" ? overflowIds : [id]}
    />
  );
};
