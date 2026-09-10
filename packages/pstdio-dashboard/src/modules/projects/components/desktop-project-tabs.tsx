import { IconButton } from "@chakra-ui/react";
import { WindowTabs, WindowTitleBar } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { Folder, Plus } from "lucide-react";
import { useSyncExternalStore } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { findDashboardProject } from "../data/project-data";
import type { DesktopProjectTabsController } from "../desktop-project-tabs-controller";

interface DesktopProjectTabsProps {
  workbench: WorkbenchCore;
  controller: DesktopProjectTabsController;
  platform: string;
}

const resolveProjectTabs = (projectIds: readonly string[], _dataVersion: number) =>
  projectIds.flatMap((id) => {
    const project = findDashboardProject(id);
    return project ? [{ id, label: project.name, icon: <Folder aria-hidden="true" /> }] : [];
  });

export const DesktopProjectTabs = (props: DesktopProjectTabsProps) => {
  const { workbench, controller, platform } = props;
  const projectIds = useSyncExternalStore(controller.subscribe, controller.getProjectIds, controller.getProjectIds);
  const dataVersion = useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);
  const selected = useWorkbenchStore(
    workbench.context.store,
    (state) => state.values[dashboardSelectedProjectIdContextKey],
  );
  const tabs = resolveProjectTabs(projectIds, dataVersion);
  return (
    <WindowTitleBar platform={platform}>
      <WindowTabs
        tabs={tabs}
        selectedId={typeof selected === "string" ? selected : undefined}
        aria-label="Project tabs"
        onSelect={(id) => void controller.select(workbench, id)}
        onClose={(id) => void controller.close(workbench, id)}
        onReorder={(id, targetId) => controller.reorder(workbench, id, targetId)}
      />
      <IconButton
        aria-label="Open project"
        title="Open project"
        variant="ghost"
        size="xs"
        onClick={() => void workbench.commands.executeCommand(dashboardCommandIds.openProjects)}
      >
        <Plus />
      </IconButton>
    </WindowTitleBar>
  );
};
