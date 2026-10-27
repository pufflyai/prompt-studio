import { Box, Text } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import {
  createWorkbenchSettingsModule,
  createWorkbenchTerminalModule,
  Workbench,
  WorkbenchThemeProvider,
} from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DesktopProjectTabsController } from "../desktop-project-tabs-controller";
import { createProjectsModule } from "../module";
import { DesktopProjectTabs } from "./desktop-project-tabs";

const ProjectSelectionStory = (props: { platform?: string }) => {
  const { platform } = props;
  const [queryClient] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
    client.setQueryData(["account-status"], { cloudProjects: [] });
    return client;
  });
  const [controller] = useState(() => new DesktopProjectTabsController([], async () => {}));
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    workbench.registerModule(createWorkbenchTerminalModule());
    workbench.registerModule(createProjectsModule({ projectTabs: platform ? controller : undefined }));
    workbench.registerModule(createWorkbenchSettingsModule());
    workbench.views.registerView({
      id: "settings.general",
      title: "General",
      body: { kind: "react", render: () => <Text p="md">General settings</Text> },
    });
    workbench.settings.registerPanel({
      id: "general",
      title: "General",
      kind: "view",
      scope: "global",
      viewId: "settings.general",
    });
    workbench.views.registerView({
      id: "status.activity",
      title: "Background activity",
      body: { kind: "react", render: () => <Text>Background activity</Text> },
    });
    workbench.statusBar.registerItem({ id: "status.activity", viewId: "status.activity", slot: "trailing" });
    workbench.modes.setActiveMode("project-selection");
    return workbench;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <WorkbenchThemeProvider>
        <Box h="100dvh">
          <Workbench
            workbench={workbench}
            panelControlsPlacement={platform ? "host" : "nav"}
            titleBar={
              platform && <DesktopProjectTabs workbench={workbench} controller={controller} platform={platform} />
            }
          />
        </Box>
      </WorkbenchThemeProvider>
    </QueryClientProvider>
  );
};

const meta = {
  title: "Dashboard/Project selection",
  component: ProjectSelectionStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ProjectSelectionStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const checkEmptyScreen = async (canvasElement: HTMLElement) => {
  const body = within(canvasElement.ownerDocument.body);
  const picker = await body.findByRole("dialog");
  await expect(within(picker).getByText("No projects yet")).toBeVisible();
  await expect(within(picker).getByRole("button", { name: "Create project" })).toBeVisible();
  for (const control of canvasElement.querySelectorAll("button, [role=tab], [data-workbench-region=status]")) {
    await expect(control).not.toBeVisible();
  }
  const main = canvasElement.querySelector<HTMLElement>('[data-workbench-panel="main"]')!;
  await expect(getComputedStyle(main).borderWidth).toBe("0px");
  const settings = within(picker).getByRole("button", { name: "Settings" });
  await expect(settings).toBeVisible();
  await userEvent.click(settings);
  await expect(await body.findByText("General settings")).toBeVisible();
  await userEvent.click(body.getByRole("button", { name: /^Close/ }));
  await expect(await body.findByText("No projects yet")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect(body.getByRole("button", { name: "Create project" })).toBeVisible();
};

export const Browser: Story = {
  play: async ({ canvasElement }) => checkEmptyScreen(canvasElement),
};

export const Mac: Story = {
  args: { platform: "darwin" },
  play: async ({ canvasElement }) => checkEmptyScreen(canvasElement),
};

export const Windows: Story = {
  args: { platform: "win32" },
  play: async ({ canvasElement }) => checkEmptyScreen(canvasElement),
};
