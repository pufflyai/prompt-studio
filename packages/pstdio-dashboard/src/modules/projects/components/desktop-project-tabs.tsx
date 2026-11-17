import { IconButton } from "@chakra-ui/react";
import { Tooltip, WindowTabs, WindowTitleBar } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { useWorkbenchStore, WorkbenchFullscreenToggle, WorkbenchPanelToggles } from "@pstdio/workbench/react";
import { Folder, Plus } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useCollectionSelection } from "@/lib/sync/use-collection-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { findDashboardProject } from "../data/project-data";
import type { DesktopProjectTabsController } from "../desktop-project-tabs-controller";

interface DesktopProjectTabsProps {
  workbench: WorkbenchCore;
  controller: DesktopProjectTabsController;
  platform: string;
}

const resolveProjectTabs = (projectIds: readonly string[], _dataVersion: unknown) =>
  projectIds.flatMap((id) => {
    const project = findDashboardProject(id);
    return project ? [{ id, label: project.name, icon: <Folder aria-hidden="true" /> }] : [];
  });

export const openProjectTabSettings = async (controller: DesktopProjectTabsController, projectId: string) => {
  controller.select(projectId);
  const workbench = controller.getActiveWorkbench();
  if (!workbench || workbench.context.get(dashboardSelectedProjectIdContextKey) !== projectId) return;
  const panel = workbench.settings.listPanels().find((panel) => panel.scope === "project" && !panel.parentPanelId);
  await workbench.commands.executeCommand("workbench.settings.open", { panelId: panel?.id });
};

export const DesktopProjectTabs = (props: DesktopProjectTabsProps) => {
  const { workbench, controller, platform } = props;
  const projectIds = useSyncExternalStore(controller.subscribe, controller.getProjectIds, controller.getProjectIds);
  const dataVersion = useCollectionSelection({ tables: ["projects"], rowIds: projectIds });
  const selected = useWorkbenchStore(
    workbench.context.store,
    (state) => state.values[dashboardSelectedProjectIdContextKey],
  );
  const tabs = resolveProjectTabs(projectIds, dataVersion).map((tab) => ({
    ...tab,
    closable: tab.id === selected,
    contextActions: [
      {
        key: "project-settings",
        label: "Project settings",
        onClick: async () => {
          try {
            await openProjectTabSettings(controller, tab.id);
          } catch (error) {
            (controller.getActiveWorkbench() ?? workbench).notifications.captureActionError("Open project settings")(
              error,
            );
          }
        },
      },
    ],
  }));
  // Clicking the tab of the project the user is already in leaves the open Sidenav level instead.
  const selectTab = (id: string) => {
    if (id === selected) workbench.pageLocations.navigateToRootLevel();
    else controller.select(id);
  };
  if (typeof selected !== "string") return <WindowTitleBar platform={platform} />;

  return (
    <WindowTitleBar
      platform={platform}
      actions={
        <>
          <WorkbenchPanelToggles workbench={workbench} />
          <WorkbenchFullscreenToggle workbench={workbench} />
        </>
      }
    >
      <WindowTabs
        tabs={tabs}
        selectedId={typeof selected === "string" ? selected : undefined}
        aria-label="Project tabs"
        onSelect={selectTab}
        onClose={(id) => controller.close(id)}
        onReorder={(id, targetId) => controller.reorder(id, targetId)}
      />
      <Tooltip content="Open / create project" positioning={{ placement: "bottom" }}>
        <IconButton
          aria-label="Open / create project"
          variant="ghost"
          size="xs"
          onClick={() => void workbench.commands.executeCommand(dashboardCommandIds.openProjects)}
        >
          <Plus />
        </IconButton>
      </Tooltip>
    </WindowTitleBar>
  );
};
