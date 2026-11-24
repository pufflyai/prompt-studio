import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";

const closeSessionViews = (ctx: WorkbenchModuleContext, projectId: string, id: string) => {
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

export const registerSessionResourceSync = (ctx: WorkbenchModuleContext) => {
  let selectionVersion = ctx.resources.getRemovalVersion();
  const stopProject = subscribeDashboardSelectedProject(ctx, () => {
    selectionVersion = ctx.resources.getRemovalVersion();
  });
  const stopSync = subscribeCollections((change) => {
    if (change?.table !== "sessions") return;
    const projectId = getDashboardSelectedProjectId(ctx);
    if (!projectId) return;
    for (const { key: id, value, previousValue } of change.changes) {
      if ((value ?? previousValue)?.project_id !== projectId || (value && value.archived !== true)) continue;
      // A full resync includes old archives. Retire their restored views on first observation,
      // and again after a real archive transition, including for legacy resource identities.
      if (
        value?.archived === true &&
        previousValue?.archived === true &&
        ctx.resources.wasRemovedSince({ type: "session", extensionId: "pstdio", projectId, id }, selectionVersion)
      )
        continue;
      closeSessionViews(ctx, projectId, id);
    }
  });
  return () => {
    stopSync();
    stopProject();
  };
};
