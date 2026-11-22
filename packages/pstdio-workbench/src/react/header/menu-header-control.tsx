import { type ComponentProps, type Dispatch, type SetStateAction, useLayoutEffect } from "react";
import type { WorkbenchPanelRegion } from "../../core";
import type { MenuHeaderPosition } from "../../core/controllers/panel-menus/menu-header-settings";
import { WorkbenchPanelMenuButton } from "../panel-menu/panel-menu-button";
import type { PanelMenuEntry } from "../panel-menu/panel-menu-entries";
import type { WorkbenchPanelMenuView } from "../panel-menu/use-panel-menu";
import { usePanelMenuContent } from "../panel-menu/use-panel-menu-content";
import { WorkbenchHeaderActions } from "./header-actions";
import { WorkbenchHeaderContribution } from "./header-contribution";

type Props = ComponentProps<typeof WorkbenchHeaderActions> & {
  panel: WorkbenchPanelRegion;
  setPresence: Dispatch<SetStateAction<Record<string, boolean>>>;
  id: string;
  menu?: PanelMenuEntry;
  menuView?: WorkbenchPanelMenuView;
  position: MenuHeaderPosition;
  compact?: boolean;
  orderKey: string;
  overflowIds: string[];
};
export const WorkbenchMenuHeaderControl = (props: Props) => {
  const { panel, id, menu, menuView, position, setPresence, compact, orderKey, overflowIds, ...actions } = props;
  const hasContent = usePanelMenuContent(props.workbench, menu?.placement);
  const present = !menu || hasContent;
  useLayoutEffect(() => {
    setPresence((current) => (current[id] === present ? current : { ...current, [id]: present }));
    return () =>
      setPresence((current) => {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
  }, [id, present, setPresence]);
  if (!present) return null;
  const vertical = position === "left" || position === "right";
  if (menu && menuView)
    return <WorkbenchPanelMenuButton workbench={props.workbench} panel={panel} entry={menu} view={menuView} />;
  if (id === "contribution") return <WorkbenchHeaderContribution key={orderKey} panel={panel} position={position} />;
  return (
    <WorkbenchHeaderActions
      {...actions}
      iconOnly={vertical || compact}
      itemIds={id === "overflow" ? overflowIds : [id]}
    />
  );
};
