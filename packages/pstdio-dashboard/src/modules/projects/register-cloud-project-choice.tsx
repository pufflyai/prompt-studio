import { standardResourceIcons, type WorkbenchModuleContext } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { createDashboardResource } from "@/shared/app/resources";
import { CloudProjectChoice } from "./components/cloud-project-choice";
import { findDashboardProject, mergeCloudProjectCatalog } from "./data/project-data";

const choiceOverlay = "dashboard-workbench.cloud-project-choice";

export const registerCloudProjectChoice = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView({
    id: choiceOverlay,
    title: "Cloud project",
    body: { kind: "react", render: (input) => <CloudProjectChoice key={input.instance.resource?.id} input={input} /> },
  });
  ctx.overlays.registerOverlay({
    id: choiceOverlay,
    viewId: choiceOverlay,
    config: { placement: "center", size: "md", closeOnInteractOutside: false },
  });

  return async (id: string, cloudCopyChoice?: boolean, name?: string) => {
    if (!cloudCopyChoice && findDashboardProject(id)) return false;
    const catalog = await getApiClient()
      .account.projectsCatalog()
      .catch(() => undefined);
    const choice = mergeCloudProjectCatalog([], catalog).find((project) => project.id === id);
    if (!choice && !cloudCopyChoice) return false;
    const title = choice?.name ?? name ?? "Cloud project";
    const resource =
      choice?.resource ?? createDashboardResource("project", id, title, standardResourceIcons.project, id);
    ctx.overlays.openOverlay(choiceOverlay, { resource, title });
    return true;
  };
};
