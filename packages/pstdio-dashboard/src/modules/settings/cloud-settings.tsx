import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { CloudAccountPanel } from "./components/cloud-account-panel";
import { CloudProjectPanel } from "./components/cloud-project-panel";

export const registerCloudSettings = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView({
    id: "dashboard.settings.cloud-account",
    title: "Account and devices",
    body: { kind: "react", render: () => <CloudAccountPanel /> },
  });
  ctx.views.registerView({
    id: "dashboard.settings.cloud-project",
    title: "Project sync",
    body: { kind: "react", render: () => <CloudProjectPanel projectId={getDashboardSelectedProjectId(ctx)} /> },
  });
  ctx.settings.registerPanel({
    kind: "view",
    id: "cloud-account",
    title: "Account and devices",
    section: "workbench",
    scope: "global",
    order: 30,
    icon: "Cloud",
    viewId: "dashboard.settings.cloud-account",
  });
  ctx.settings.registerPanel({
    kind: "view",
    id: "cloud-project",
    title: "Project sync",
    section: "project",
    scope: "project",
    order: 25,
    icon: "Cloud",
    viewId: "dashboard.settings.cloud-project",
  });
};
