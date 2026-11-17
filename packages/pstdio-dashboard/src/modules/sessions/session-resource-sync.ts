import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";

const closeSessionViews = (ctx: WorkbenchModuleContext, id: string) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) return;
  // Legacy URLs/layouts omitted either scope. Retire all known keys, including
  // closed history not returned by getOpenResources; explicit foreign scopes differ.
  const base = { type: "session", id };
  const references: ResourceRef[] = [
    { ...base, extensionId: "pstdio", projectId },
    { ...base, extensionId: "pstdio" },
    { ...base, projectId },
    base,
  ];
  for (const resource of references) ctx.resources.removed(resource);
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
