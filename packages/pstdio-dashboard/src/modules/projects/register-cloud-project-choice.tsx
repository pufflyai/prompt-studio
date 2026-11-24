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
    const client = getApiClient();
    const status = await client.account.status().catch(() => undefined);
    const accountId = status?.teamProjectOwners?.[id] ?? status?.teamProjects?.[id];
    const catalog = await client.account
      .projectsCatalog({ accountId, expectedDevice: status?.login ?? undefined })
      .catch(() => undefined);
    const choice = mergeCloudProjectCatalog([], catalog).find((project) => project.id === id);
    if (!choice && !cloudCopyChoice) return false;
    const title = choice?.name ?? name ?? "Cloud project";
    const resource =
      choice?.resource ?? createDashboardResource("project", id, title, standardResourceIcons.project, id);
    ctx.overlays.openOverlay(choiceOverlay, {
      resource,
      title,
      ...(accountId && {
        pageContext: { page: { kind: "page", extensionId: "pstdio", id: choiceOverlay }, params: { accountId } },
      }),
    });
    return true;
  };
};
