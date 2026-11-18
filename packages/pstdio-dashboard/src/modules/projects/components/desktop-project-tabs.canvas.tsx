import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import { WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { useState } from "react";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { DashboardWorkbenchView } from "@/shared/workbench/dashboard-workbench-view";
import { DesktopProjectTabsController } from "../desktop-project-tabs-controller";
import { DesktopProjectTabs } from "./desktop-project-tabs";

const ProjectTabsStory = () => {
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    selectDashboardProject(workbench, { id: "project", name: "Project" });
    return workbench;
  });
  const [controller] = useState(() => new DesktopProjectTabsController([], async () => {}));
  return <DesktopProjectTabs workbench={workbench} controller={controller} platform="darwin" />;
};

const WindowControlsOverlayStory = () => {
  const [workbench] = useState(() => {
    // Canvas frames have an opaque origin and no browser session.
    if (window.origin === "null") Object.defineProperty(window, "localStorage", { value: undefined });
    getWriter("projects")?.truncateAndWrite([{ id: "project", name: "Project" }]);
    const page = { kind: "page", extensionId: "preview", id: "project" } as const;
    const workbench = createWorkbench({ startPage: page });
    workbench.presence.register({
      getParticipants: () => [{ id: "editor", label: "Alex" }],
      subscribe: () => () => {},
    });
    workbench.modes.registerMode({ id: "project", activate() {} });
    workbench.views.registerView({ id: "project", title: "Project", body: { kind: "react", render: () => "Project" } });
    workbench.pages.registerPage({
      id: "project",
      ref: page,
      path: "project",
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "project" }, cardinality: "one" },
      slots: [],
    });
    selectDashboardProject(workbench, { id: "project", name: "Project" });
    workbench.pageLocations.switchProject("project");
    workbench.pageLocations.navigate({ kind: "page", page });
    return workbench;
  });
  const [controller] = useState(() => new DesktopProjectTabsController(["project"], async () => {}));
  return (
    <WorkbenchThemeProvider>
      <Box h="100dvh" css={{ "--pstdio-title-bar-area-width": "calc(100% - 140px)" }}>
        <DashboardWorkbenchView
          workbench={workbench}
          panelControlsPlacement="host"
          storage={undefined}
          titleBar={<DesktopProjectTabs workbench={workbench} controller={controller} platform="linux" />}
        />
      </Box>
    </WorkbenchThemeProvider>
  );
};
const meta = {
  title: "Product/Projects/Tabs",
  component: ProjectTabsStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof ProjectTabsStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const OpenProjectHover: Story = {
  id: "dashboard-project-tabs--open-project-hover",
};
export const OpenProjectFocus: Story = {
  id: "dashboard-project-tabs--open-project-focus",
};
export const WindowControlsOverlay: Story = {
  name: "Window controls overlay",
  render: () => <WindowControlsOverlayStory />,
};
