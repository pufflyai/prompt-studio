import { useState, useSyncExternalStore } from "react";
import { useCloudContext } from "./cloud-context";
import { createCloudStore } from "./cloud-store";

export const useCloud = (projectId: string | undefined, includeDevices: boolean) => {
  const { client } = useCloudContext();
  // The mounting view is keyed by project, so an old project's read cannot populate a new one.
  const [store] = useState(() => createCloudStore(client, projectId, includeDevices));
  const snapshot = useSyncExternalStore(store.subscribe, store.get);
  return { ...snapshot, refresh: store.refresh };
};
