import { Box } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import { headerTrailingMenuPath, type WorkbenchCore, type WorkbenchPanelRegion } from "../../core";
import { WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { useWorkbenchPanelMenus } from "../panel-menu/use-panel-menu";
import { usePanelViewSlot } from "../region/panel-view-hosts";
import { useWorkbenchActivePanel } from "../shared/use-workbench-active-panel";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchHeaderItems, WorkbenchHeaderActions } from "./header-actions";

/** Page chrome and tab subheaders receive the same retained, instance-owned header host. */
export const WorkbenchContentHeader = (props: {
  workbench: WorkbenchCore;
  panel: WorkbenchPanelRegion;
  inline?: boolean;
}) => {
  const { workbench, panel, inline = false } = props;
  const placement = useWorkbenchActivePanel(workbench, panel);
  const header = useWorkbenchStore(workbench.views.store, () =>
    placement?.viewId ? workbench.views.getView(placement.viewId)?.header : undefined,
  );
  const menus = useWorkbenchPanelMenus(workbench, panel);
  const menuPath = headerTrailingMenuPath(panel);
  const { items } = useWorkbenchHeaderItems(workbench, menuPath, placement);
  const standalone = useWorkbenchStore(
    workbench.pages.store,
    () => panel === "main" && Boolean(workbench.pages.getContent()),
  );
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  const presents = inline ? standalone && !fullscreen : !standalone || fullscreen;
  const visible = presents && Boolean(header || items.length || menus.some((menu) => menu.has));
  const slot = usePanelViewSlot(panel, inline ? "page-header" : "header");
  return (
    <Header
      variant="narrow"
      data-workbench-content-header={panel}
      display={visible ? "flex" : "none"}
      flex={inline ? "1" : undefined}
      h={inline ? "full" : undefined}
      minW="0"
      flexShrink={0}
      gap="xs"
      borderBottomWidth={inline ? "0" : "1px"}
      borderColor="border.subtle"
    >
      <Box ref={slot.ref} display="flex" flex="1" minW="0" minH="0" h="full" overflow="hidden" />
      {presents ? <WorkbenchHeaderActions workbench={workbench} menuPath={menuPath} placement={placement} /> : null}
      {presents ? <WorkbenchPanelMenuOpeners workbench={workbench} panel={panel} toggle /> : null}
    </Header>
  );
};
