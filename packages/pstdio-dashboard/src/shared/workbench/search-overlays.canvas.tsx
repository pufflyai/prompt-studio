import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import { WorkbenchOverlayLayer } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { createNotificationsModule } from "@/modules/notifications/module";
import { ProjectStoryFixture } from "@/modules/projects/data/project-story-fixture";
import { createProjectsModule } from "@/modules/projects/module";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { readSettings, receiveSettings } from "@/shared/settings/synced-settings";

interface SearchOverlayStoryProps {
  overlay: "Projects" | "Notifications";
  projectCount?: number;
}
const SearchOverlayStory = (props: SearchOverlayStoryProps) => {
  const { overlay, projectCount = 8 } = props;
  const [workbench] = useState(() => createWorkbench());
  useEffect(() => {
    const previousSettings = readSettings();
    const previousProjects = Array.from(getCollection("projects").state.values());
    if (overlay === "Projects") {
      getWriter("projects")?.truncateAndWrite(
        Array.from({ length: projectCount }, (_, index) => ({
          id: `storybook-project-${index}`,
          name: `Project ${index + 1}`,
          created_at: "2026-10-16T09:00:00.000Z",
        })),
      );
    }
    receiveSettings({ notifications_enabled: true, machine_tokens_enabled: false, max_concurrent_sessions: null });
    const projects = workbench.registerModule(createProjectsModule());
    const notifications = workbench.registerModule(createNotificationsModule());
    selectDashboardProject(workbench, { id: "storybook-search-overlays", name: "Prompt Studio" });
    const command = overlay === "Projects" ? dashboardCommandIds.openProjects : dashboardCommandIds.openNotifications;
    void workbench.commands.executeCommand(command);
    return () => {
      notifications.dispose();
      projects.dispose();
      if (overlay === "Projects") getWriter("projects")?.truncateAndWrite(previousProjects);
      if (previousSettings) receiveSettings(previousSettings);
      else getWriter("settings")?.remove("global");
    };
  }, [overlay, projectCount, workbench]);
  return <WorkbenchOverlayLayer workbench={workbench} />;
};
const meta = {
  title: "Dashboard/Search overlays",
  component: SearchOverlayStory,
  decorators: [
    (Story) => (
      <ProjectStoryFixture>
        <Story />
      </ProjectStoryFixture>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Search overlays use the shared dialog close position to center the control beside the search field.",
      },
    },
  },
} satisfies CanvasMeta<typeof SearchOverlayStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Projects: Story = {
  id: "dashboard-search-overlays--projects",
  args: { overlay: "Projects" },
};
export const Notifications: Story = {
  id: "dashboard-search-overlays--notifications",
  args: { overlay: "Notifications" },
};
export const NoProjects: Story = {
  id: "dashboard-search-overlays--no-projects",
  args: { overlay: "Projects", projectCount: 0 },
};
export const SmallProjectList: Story = {
  id: "dashboard-search-overlays--small-project-list",
  args: { overlay: "Projects", projectCount: 7 },
};
export const OneProject: Story = {
  id: "dashboard-search-overlays--one-project",
  args: { overlay: "Projects", projectCount: 1 },
};
export const FilterProjects: Story = {
  id: "dashboard-search-overlays--filter-projects",
  args: { overlay: "Projects", projectCount: 8 },
};
