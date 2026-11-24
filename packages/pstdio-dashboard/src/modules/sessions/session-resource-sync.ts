import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { type CollectionRowChange, subscribeCollections } from "@/lib/sync/collections";
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

const syncSession = (
  ctx: WorkbenchModuleContext,
  projectId: string,
  retired: Set<string>,
  { key: id, value, previousValue }: CollectionRowChange,
) => {
  if ((value ?? previousValue)?.project_id !== projectId) return;
  if (value?.archived !== true) {
    retired.delete(id);
    if (value) return;
  }
  // Only this subscriber retires all four aliases. A resolver can retire just the open one.
  if (retired.has(id)) return;
  closeSessionViews(ctx, projectId, id);
  if (value) retired.add(id);
};

export const registerSessionResourceSync = (ctx: WorkbenchModuleContext) => {
  let retiredArchives = new Set<string>();
  const stopProject = subscribeDashboardSelectedProject(ctx, () => {
    retiredArchives = new Set();
  });
  const stopSync = subscribeCollections((change) => {
    if (change?.table !== "sessions") return;
    const projectId = getDashboardSelectedProjectId(ctx);
    if (!projectId) return;
    const retired = retiredArchives;
    for (const row of change.changes) syncSession(ctx, projectId, retired, row);
  });
  return () => {
    stopSync();
    stopProject();
  };
};
