import { createWorkbench } from "@pstdio/workbench";
import { WorkbenchOverlayLayer } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { getWriter } from "@/lib/sync/collections";
import { createNotificationsModule } from "@/modules/notifications/module";
import { createProjectsModule } from "@/modules/projects/module";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { readSettings, receiveSettings } from "@/shared/settings/synced-settings";

interface SearchOverlayStoryProps {
  overlay: "Projects" | "Notifications";
}

const SearchOverlayStory = (props: SearchOverlayStoryProps) => {
  const { overlay } = props;
  const [workbench] = useState(() => createWorkbench());
  useEffect(() => {
    const previousSettings = readSettings();
    receiveSettings({ notifications_enabled: true, max_concurrent_sessions: null });
    const projects = workbench.registerModule(createProjectsModule());
    const notifications = workbench.registerModule(createNotificationsModule());
    selectDashboardProject(workbench, { id: "storybook-search-overlays", name: "Prompt Studio" });
    const command = overlay === "Projects" ? dashboardCommandIds.openProjects : dashboardCommandIds.openNotifications;
    void workbench.commands.executeCommand(command);
    return () => {
      notifications.dispose();
      projects.dispose();
      if (previousSettings) receiveSettings(previousSettings);
      else getWriter("settings")?.remove("global");
    };
  }, [overlay, workbench]);
  return <WorkbenchOverlayLayer workbench={workbench} />;
};

const meta = {
  title: "Dashboard/Search overlays",
  component: SearchOverlayStory,
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
