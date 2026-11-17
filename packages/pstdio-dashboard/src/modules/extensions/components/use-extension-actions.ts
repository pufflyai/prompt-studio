import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { getExtensionActions } from "./extension-actions";

export const useExtensionActions = (projectId: string | undefined) => {
  const owner = getExtensionActions(useQueryClient(), projectId);
  const snapshot = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  return { ...owner, ...snapshot };
};
