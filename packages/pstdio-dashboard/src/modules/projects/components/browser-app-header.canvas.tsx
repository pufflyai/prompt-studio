import { Box, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench, WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { useState } from "react";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createHeadersModule } from "../../headers/module";
import { ProjectStoryFixture } from "../data/project-story-fixture";
import { createProjectsModule } from "../module";
import { BrowserAppHeader } from "./browser-app-header";

export default {
  title: "Product/Projects/Web app header",
  description:
    "Project selection and panel controls stay above all workbench panels, matching the desktop shell. Page history and breadcrumbs stay with Main.",
  fullscreen: true,
} satisfies CanvasMeta;

export const AppAndPageHeaders = () => {
  const [workbench] = useState(() => {
    const page = { kind: "page", extensionId: "preview", id: "project" } as const;
    const workbench = createWorkbench({ defaultPage: page });
    workbench.modes.registerMode({ id: "project", activate() {} });
    workbench.views.registerView({
      id: "overview",
      title: "Overview",
      body: { kind: "react", render: () => <Text p="md">Project overview</Text> },
    });
    workbench.pages.registerPage({
      id: "project",
      ref: page,
      title: "Overview",
      path: "project",
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "overview" }, cardinality: "one" },
      slots: [],
    });
    getWriter("projects")?.truncateAndWrite([{ id: "project", name: "Project" }]);
    workbench.registerModule(createProjectsModule({ initialProjectId: "project" }));
    workbench.registerModule(createHeadersModule());
    selectDashboardProject(workbench, { id: "project", name: "Project" });
    workbench.pageLocations.setProject("project");
    workbench.pageLocations.navigate({ kind: "page", page });
    return workbench;
  });
  return (
    <ProjectStoryFixture>
      <WorkbenchThemeProvider>
        <Box h="100dvh">
          <Workbench
            workbench={workbench}
            panelControlsPlacement="host"
            keepTitleBarInFullscreen
            titleBar={<BrowserAppHeader workbench={workbench} />}
          />
        </Box>
      </WorkbenchThemeProvider>
    </ProjectStoryFixture>
  );
};
