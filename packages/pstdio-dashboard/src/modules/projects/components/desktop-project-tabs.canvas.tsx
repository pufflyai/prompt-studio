import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import { useState } from "react";
import { selectDashboardProject } from "@/shared/app/project-context";
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
const meta = {
  title: "Dashboard/Project tabs",
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
