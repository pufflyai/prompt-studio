import { useState, useSyncExternalStore } from "react";
import { useCloudContext } from "./cloud-context";
import { createCloudStore } from "./cloud-store";

const subscribeConnectivity = (listener: () => void) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};
const isOnline = () => navigator.onLine;

export const useCloud = (projectId: string | undefined, includeDevices: boolean) => {
  const { client } = useCloudContext();
  // The mounting view is keyed by project, so an old project's read cannot populate a new one.
  const [store] = useState(() =>
    createCloudStore(
      client,
      projectId,
      includeDevices,
      projectId ? () => client.commands["project-state"]() : undefined,
    ),
  );
  const snapshot = useSyncExternalStore(store.subscribe, store.get);
  const online = useSyncExternalStore(subscribeConnectivity, isOnline);
  const data =
    snapshot.data && !online && snapshot.data.account.login
      ? { ...snapshot.data, sync: { ...snapshot.data.sync, state: "offline" as const } }
      : snapshot.data;
  return { ...snapshot, data, refresh: store.refresh };
};
