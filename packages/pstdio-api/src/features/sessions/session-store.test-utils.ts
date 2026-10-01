import { mock } from "bun:test";
import { createSessionStore, type SessionChannelHooks } from "./session-store";

/** Channel hooks for tests that only need an entry to exist. */
export const inertSessionChannelHooks: SessionChannelHooks = {
  onApprovalRequest: () => {},
  onQuestionAsked: () => {},
  onQuestionAnswered: () => {},
};

export const createTrackedSessionStore = () => {
  const store = createSessionStore();
  return {
    ...store,
    create: mock(store.create),
    setSession: mock(store.setSession),
    remove: mock(store.remove),
  };
};

export const checkpointFileService = {
  get: async () => null,
  upload: async () => ({ id: "checkpoint" }),
  update: async () => null,
};
