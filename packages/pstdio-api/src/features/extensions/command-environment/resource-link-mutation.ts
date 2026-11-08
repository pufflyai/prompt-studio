import type { ScopedHostApis } from "pstdio-extensions";

const rejectLinkMutation = async (): Promise<never> => {
  throw new Error("Anchor validators cannot mutate resource links.");
};

export const restrictResourceLinkMutations = (apis: ScopedHostApis) => ({
  ...apis,
  resources: {
    ...apis.resources,
    addAnchors: rejectLinkMutation,
    removeAnchors: rejectLinkMutation,
    removed: rejectLinkMutation,
  },
  workspaces: {
    ...apis.workspaces,
    create: rejectLinkMutation,
    addAnchors: rejectLinkMutation,
    removeAnchors: rejectLinkMutation,
    delete: rejectLinkMutation,
    cancel: rejectLinkMutation,
  },
  sessions: {
    ...apis.sessions,
    create: rejectLinkMutation,
    addAnchors: rejectLinkMutation,
    removeAnchors: rejectLinkMutation,
    delete: rejectLinkMutation,
  },
});
