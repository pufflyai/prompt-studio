import { useSyncExternalStore } from "react";
import { getProjectExtensionQueries } from "@/shared/extensions/project-extension-queries";
import { getExtensionActions } from "./extension-actions";

export const useExtensionActions = (projectId: string | undefined) => {
  const owner = getExtensionActions(getProjectExtensionQueries(projectId).extensions);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  return { ...owner, ...snapshot };
};
