import { mock } from "bun:test";
import { createSessionStore } from "./session-store";

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
