import type { getApiClient } from "@/lib/api";

type SetupRequest = ReturnType<typeof getApiClient>["projects"]["open"];

/** Automatic opening and Retry share ownership until the local folder request settles. */
export const createProjectSetupRequests = () => {
  const pending = new Map<string, ReturnType<SetupRequest>>();
  return {
    run(projectId: string, prepare: () => ReturnType<SetupRequest>) {
      const existing = pending.get(projectId);
      if (existing) return existing;
      const work = Promise.resolve()
        .then(prepare)
        .finally(() => {
          if (pending.get(projectId) === work) pending.delete(projectId);
        });
      pending.set(projectId, work);
      return work;
    },
  };
};
