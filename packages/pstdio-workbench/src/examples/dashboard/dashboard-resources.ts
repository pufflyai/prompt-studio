import type { WorkbenchCore } from "../../core";
import { dashboardSessions, dashboardWorkspaces } from "./dashboard-data";

export const registerDashboardResources = (workbench: WorkbenchCore) => {
  for (const [kind, label, resources] of [
    ["demo.workspace", "Workspace", dashboardWorkspaces],
    ["demo.session", "Session", dashboardSessions],
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
