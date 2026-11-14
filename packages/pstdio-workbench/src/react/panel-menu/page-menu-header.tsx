import { Text } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { resolvePageContent } from "../../core/registries/pages/page-content";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { usePlacementTab } from "../shared/use-placement-tab";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "../workbench/header-bottom-border";
import { WorkbenchPanelMenuOpeners } from "./panel-menu";
import { useWorkbenchPanelMenus } from "./use-panel-menu";

interface WorkbenchPageMenuHeaderProps {
  workbench: WorkbenchCore;
}

// Pages can supply a title through their standard presentation without adding tabs.
export const WorkbenchPageMenuHeader = (props: WorkbenchPageMenuHeaderProps) => {
  const { workbench } = props;
  const policy = usePanelPolicy(workbench, "main");
  const pageContent = useWorkbenchStore(workbench.pages.store, resolvePageContent);
  const snapshot = usePlacementTab(pageContent, workbench);
  const menus = useWorkbenchPanelMenus(workbench, "main");
  const hasTitle = Boolean(snapshot.label);
  if (policy.showHeader || !pageContent || (!hasTitle && !menus.some((menu) => menu.has && menu.collapsed)))
    return null;

  return (
    <Header
      data-workbench-page-menu-header="main"
      aria-label="Main menu header"
      bg={workbenchBackgrounds.main}
      justifyContent="flex-end"
      flexShrink={0}
      gap="xs"
      position="relative"
    >
      {hasTitle && (
        <>
          {snapshot.icon && <WorkbenchIcon name={snapshot.icon} size={14} />}
          <Text flex="1" minW="0" textStyle="label/S/regular" truncate>
            {snapshot.label}
          </Text>
        </>
      )}
      <WorkbenchPanelMenuOpeners workbench={workbench} panel="main" toggle={hasTitle} />
      {hasTitle && <WorkbenchHeaderBorder workbench={workbench} region="main-header" />}
    </Header>
  );
};
