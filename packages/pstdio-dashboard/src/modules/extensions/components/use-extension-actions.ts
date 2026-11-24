import { getWorkbenchOperations } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getProjectExtensionQueries } from "@/shared/extensions/project-extension-queries";
import { getExtensionActions } from "./extension-actions";

export const useExtensionActions = (projectId: string | undefined) => {
  const queries = getDashboardScopedQueries();
  const inventory = getProjectExtensionQueries(projectId, { queries }).extensions;
  const tracker = projectId
    ? { projectId, operations: getWorkbenchOperations(queries), isCurrent: () => !inventory.isDisposed() }
    : undefined;
  const owner = getExtensionActions(inventory, tracker);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  return { ...owner, ...snapshot };
};
