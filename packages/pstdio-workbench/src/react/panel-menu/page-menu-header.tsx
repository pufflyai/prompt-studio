import { Header } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { resolvePageContent } from "../../core/registries/pages/page-content";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchPanelMenuOpeners } from "./panel-menu";
import { useWorkbenchPanelMenus } from "./use-panel-menu";

interface WorkbenchPageMenuHeaderProps {
  workbench: WorkbenchCore;
}

export const WorkbenchPageMenuHeader = (props: WorkbenchPageMenuHeaderProps) => {
  const { workbench } = props;
  const policy = usePanelPolicy(workbench, "main");
  const pageContent = useWorkbenchStore(workbench.pages.store, resolvePageContent);
  const menus = useWorkbenchPanelMenus(workbench, "main");
  if (policy.showHeader || !pageContent || !menus.some((menu) => menu.has && (menu.collapsed || menu.collapsible))) {
    return null;
  }

  return (
    <Header
      data-workbench-page-menu-header="main"
      aria-label="Main menu header"
      bg={workbenchBackgrounds.main}
      justifyContent="flex-end"
      flexShrink={0}
    >
      <WorkbenchPanelMenuOpeners workbench={workbench} panel="main" toggle />
    </Header>
  );
};
