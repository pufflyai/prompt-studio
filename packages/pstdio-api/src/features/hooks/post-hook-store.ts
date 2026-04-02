import type { AttemptStatusHookName, HookPayload } from "pstdio-hooks";

export type QueuedPostHook = {
  hookName: AttemptStatusHookName;
  statusChangeId: string;
  projectId: string;
  fromStatus: string;
  toStatus: string;
  payload: HookPayload;
};

export const createPostHookStore = () => {
  const pending = new Map<string, QueuedPostHook>();

  return {
    queue: (sessionId: string, entry: QueuedPostHook) => {
      pending.set(sessionId, entry);
    },

    get: (sessionId: string) => pending.get(sessionId),

    consume: (sessionId: string) => {
      const entry = pending.get(sessionId);
      if (entry) pending.delete(sessionId);
      return entry;
    },
  };
};
