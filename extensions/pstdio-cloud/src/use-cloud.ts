import {
  useScopedQueries,
  useWebviewCommandQuery,
  useWebviewScope,
  useWebviewVisibility,
} from "@pstdio/sdk/extensions/react";
import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { useCloudContext } from "./cloud-context";
import { createCloudQueries } from "./cloud-queries";
import type { CloudProjectState } from "./project-state";

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
  useWebviewScope(client.queries);
  const queries = createCloudQueries(client, projectId);
  const visible = useWebviewVisibility();
  const account = useWebviewCommandQuery(queries.account, visible);
  const sync = useWebviewCommandQuery(queries.projectSync, visible && account.data !== undefined);
  const login = account.data?.login;
  const deviceQuery = includeDevices && login ? queries.devices(login) : undefined;
  const devices = useScopedQueries(deviceQuery ? [deviceQuery] : [], visible)[0];
  const projectQuery = projectId && sync.data?.offlineReady ? queries.projectState() : undefined;
  const project = useScopedQueries(projectQuery ? [projectQuery] : [], visible)[0];
  const [refreshOwner, setRefreshOwner] = useState<{
    account: typeof queries.account;
    sync: typeof queries.projectSync;
    devices: typeof deviceQuery;
    project: typeof projectQuery;
    abort: AbortController;
  }>();
  useLayoutEffect(() => {
    if (!visible) return;
    const abort = new AbortController();
    setRefreshOwner({
      account: queries.account,
      sync: queries.projectSync,
      devices: deviceQuery,
      project: projectQuery,
      abort,
    });
    return () => abort.abort();
  }, [visible, queries.account, queries.projectSync, deviceQuery, projectQuery]);
  const pendingPreparation: CloudProjectState | undefined =
    projectQuery && !project?.error ? { state: "preparing" } : undefined;
  const online = useSyncExternalStore(subscribeConnectivity, isOnline);
  return {
    data:
      account.data && sync.data
        ? {
            account: account.data,
            sync: online ? sync.data : { ...sync.data, state: "offline" as const },
            signingIn: account.data.loginAttempt?.status === "pending",
            loginFailed: account.data.loginAttempt?.status === "failed",
            devices: devices?.data ?? [],
            project: project?.data ?? pendingPreparation,
          }
        : undefined,
    online,
    error: account.error?.message ?? sync.error?.message ?? project?.error?.message ?? devices?.error?.message,
    refresh: () => {
      const signal = refreshOwner?.abort.signal;
      if (
        !visible ||
        !signal ||
        signal.aborted ||
        refreshOwner?.account !== queries.account ||
        refreshOwner?.sync !== queries.projectSync ||
        refreshOwner?.devices !== deviceQuery ||
        refreshOwner?.project !== projectQuery
      )
        return;
      for (const query of [queries.account, queries.projectSync, deviceQuery, projectQuery])
        if (query) {
          if ("refresh" in query) void query.refresh(signal).catch(() => {});
          else query.invalidate();
        }
    },
  };
};
