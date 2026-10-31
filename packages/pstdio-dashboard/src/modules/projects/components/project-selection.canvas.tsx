import { Box, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import {
  createWorkbenchSettingsModule,
  createWorkbenchTerminalModule,
  Workbench,
  WorkbenchThemeProvider,
} from "@pstdio/workbench/react";
import { useState } from "react";
import { ProjectStoryFixture } from "../data/project-story-fixture";
import { DesktopProjectTabsController } from "../desktop-project-tabs-controller";
import { createProjectsModule } from "../module";
import { DesktopProjectTabs } from "./desktop-project-tabs";

const ProjectSelectionStory = (props: { platform?: string }) => {
  const { platform } = props;
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
    <ProjectStoryFixture>
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
    </ProjectStoryFixture>
  );
};
const meta = {
  title: "Dashboard/Project selection",
  component: ProjectSelectionStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof ProjectSelectionStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Browser: Story = {
  id: "dashboard-project-selection--browser",
};
export const Mac: Story = {
  id: "dashboard-project-selection--mac",
  args: { platform: "darwin" },
};
export const Windows: Story = {
  id: "dashboard-project-selection--windows",
  args: { platform: "win32" },
};
