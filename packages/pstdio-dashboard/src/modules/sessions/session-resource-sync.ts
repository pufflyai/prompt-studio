import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";

const closeSessionViews = (ctx: WorkbenchModuleContext, id: string) => {
  const resource: ResourceRef = {
    type: "session",
    id,
    extensionId: "pstdio",
    projectId: getDashboardSelectedProjectId(ctx),
  };
  ctx.resources.removed(resource);
};

export const registerSessionResourceSync = (ctx: WorkbenchModuleContext) =>
  subscribeCollections((change) => {
    if (change?.table !== "sessions") return;
    for (const { key: id, value, previousValue } of change.changes) {
      if ((value ?? previousValue)?.project_id !== getDashboardSelectedProjectId(ctx)) continue;
      if (value && value.archived !== true) continue;
      // Archive also removes visible placements without deleting the saved session.
      closeSessionViews(ctx, id);
    }
  });
