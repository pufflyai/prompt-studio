import { createWorkbench } from "@pstdio/workbench";
import { WorkbenchOverlayLayer } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const close = await body.findByRole("button", { name: `Close ${args.overlay}` });
    const dialog = close.closest('[role="dialog"]');
    const search = dialog?.querySelector("input");
    await waitFor(() => expect(search).toBeVisible());
    await waitFor(() => {
      const buttonRect = close.getBoundingClientRect();
      const inputRect = search!.getBoundingClientRect();
      const difference = Math.abs(buttonRect.y + buttonRect.height / 2 - inputRect.y - inputRect.height / 2);
      expect(difference).toBeLessThanOrEqual(1);
    });
    await userEvent.click(close);
    await waitFor(() => expect(body.queryByRole("button", { name: `Close ${args.overlay}` })).toBeNull());
  },
} satisfies Meta<typeof SearchOverlayStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Projects: Story = { args: { overlay: "Projects" } };
export const Notifications: Story = { args: { overlay: "Notifications" } };

const expectProjectList = async (canvasElement: HTMLElement, count: number) => {
  const body = within(canvasElement.ownerDocument.body);
  const dialog = await body.findByRole("dialog");
  await expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  await expect(within(dialog).getByRole("button", { name: "Create project" })).toBeVisible();
  for (let index = 1; index <= count; index++) {
    await expect(within(dialog).getByText(`Project ${index}`, { exact: true })).toBeVisible();
  }
};

export const NoProjects: Story = {
  args: { overlay: "Projects", projectCount: 0 },
  play: async ({ canvasElement }) => expectProjectList(canvasElement, 0),
};

export const SmallProjectList: Story = {
  args: { overlay: "Projects", projectCount: 7 },
  play: async ({ canvasElement }) => expectProjectList(canvasElement, 7),
};

export const OneProject: Story = {
  args: { overlay: "Projects", projectCount: 1 },
  play: async ({ canvasElement }) => expectProjectList(canvasElement, 1),
};

export const FilterProjects: Story = {
  args: { overlay: "Projects", projectCount: 8 },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    const search = within(dialog).getByRole("textbox");
    await userEvent.type(search, "Project 8");
    await expect(within(dialog).getByText("Project 8", { exact: true })).toBeVisible();
    await expect(within(dialog).queryByText("Project 1", { exact: true })).not.toBeInTheDocument();
    await expect(search).toBeVisible();
    await userEvent.clear(search);
    await expect(within(dialog).getByText("Project 1", { exact: true })).toBeVisible();
  },
};
