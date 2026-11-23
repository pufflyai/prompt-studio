import { useSyncExternalStore } from "react";
import type { getApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";

type SetupRequest = ReturnType<typeof getApiClient>["projects"]["open"];

/** Automatic opening and Retry share ownership until the local folder request settles. */
export const createProjectSetupRequests = (authority = () => "local") => {
  const pending = new Map<string, ReturnType<SetupRequest>>();
  const listeners = new Set<() => void>();
  const key = (projectId: string) => JSON.stringify([authority(), projectId]);
  const publish = () => {
    for (const listener of listeners) listener();
  };
  return {
    run(projectId: string, prepare: () => ReturnType<SetupRequest>) {
      const requestKey = key(projectId);
      const existing = pending.get(requestKey);
      if (existing) return existing;
      const origin = authority();
      const assertCurrent = () => {
        if (authority() !== origin) throw new Error("The original project authority is no longer active.");
      };
      const work = Promise.resolve()
        .then(() => {
          assertCurrent();
          return prepare();
        })
        .then((workspace) => {
          assertCurrent();
          return workspace;
        })
        .finally(() => {
          if (pending.get(requestKey) === work) {
            pending.delete(requestKey);
            publish();
          }
        });
      pending.set(requestKey, work);
      publish();
      return work;
    },
    pending: (projectId?: string) => Boolean(projectId && pending.has(key(projectId))),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish,
  };
};

export type ProjectSetupRequests = Pick<ReturnType<typeof createProjectSetupRequests>, "run">;

export const getProjectSetupRequests = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  let revision = 0;
  const requests = createProjectSetupRequests(() => {
    const { runtimeId, accountId, accountOrigin } = queries.getScope();
    return JSON.stringify([runtimeId, accountId, accountOrigin, revision]);
  });
  queries.subscribeScopeRetirement((retired) => {
    if (Object.keys(retired).length === 0) revision++;
    requests.publish();
  });
  return requests;
});

export const useProjectSetupPending = (projectId?: string) => {
  const requests = getProjectSetupRequests();
  const pending = () => requests.pending(projectId);
  return useSyncExternalStore(requests.subscribe, pending, pending);
};
