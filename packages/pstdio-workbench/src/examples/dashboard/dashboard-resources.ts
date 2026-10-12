import type { WorkbenchCore } from "../../core";
import { dashboardSessions, dashboardWorkspaces } from "./dashboard-data";

export const registerDashboardResources = (workbench: WorkbenchCore) => {
  for (const [kind, label, resources] of [
    ["demo.workspace", "Workspace", dashboardWorkspaces],
    ["demo.session", "Session", dashboardSessions],
    [
      "demo.file",
      "File",
      dashboardWorkspaces.flatMap((workspace) =>
        ["src/app.ts", "package.json"].map((path) => ({
          type: "demo.file",
          id: `${workspace.id}/${path}`,
          label: path.split("/").at(-1)!,
          metadata: { workspaceId: workspace.id, path },
        })),
      ),
    ],
  ] as const) {
    workbench.resources.registerKind({ kind, label });
    workbench.resources.registerProvider({
      id: kind,
      kind,
      list: (query) =>
        resources
          .filter((resource) => resource.label?.toLowerCase().includes(query.toLowerCase()))
          .map((resource) => ({ resource })),
    });
  }
};
