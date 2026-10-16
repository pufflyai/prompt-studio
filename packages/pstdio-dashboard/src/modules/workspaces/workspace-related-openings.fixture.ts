import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { createWorkbenchTerminalModule } from "@pstdio/workbench/react";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createSessionBubbleModule } from "../sessions/bubble/module";
import { createSessionsModule } from "../sessions/module";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "./module";

export const setupWorkspaceOpening = (ready = true) => {
  if (ready) markInitialCollectionsSyncComplete();
  const workbench = createWorkbench();
  for (const module of [
    createSidenavModule(),
    createWorkspacesModule(),
    createSessionBubbleModule(),
    createSessionsModule(),
    createWorkbenchTerminalModule(),
  ])
    workbench.registerModule(module);
  selectDashboardProject(workbench, { id: "project", name: "Project" });
  getWriter("workspaces")?.truncateAndWrite([
    {
      id: "workspace",
      project_id: "project",
      name: "Workspace",
      archived: false,
      root_path: "/repo",
      is_default: true,
    },
  ]);
  const source = { type: "workspace", id: "workspace", extensionId: "pstdio", projectId: "project" };
  const resolve = (resource = source, signal = new AbortController().signal) =>
    workbench.resources.getKind("workspace")?.relatedOpenings?.(resource, signal);
  return { workbench, ctx: workbench as WorkbenchModuleContext, source, resolve };
};
