import type { ProjectExtensionRuntimeSnapshot } from "./project-extension-runtime-snapshot";

export const createProjectRuntimeActivation = (
  get: (projectId: string) => Promise<ProjectExtensionRuntimeSnapshot>,
) => {
  const listeners = new Set<(projectId: string) => unknown | Promise<unknown>>();
  const activations = new Map<string, Promise<void>>();
  return {
    activate: async (projectId: string) => {
      const snapshot = await get(projectId);
      let activation = activations.get(projectId);
      if (!activation) {
        activation = Promise.resolve().then(async () => {
          await Promise.all([...listeners].map((listener) => listener(projectId)));
        });
        activations.set(projectId, activation);
      }
      await activation;
      return snapshot;
    },
    subscribeActivation: (listener: (projectId: string) => unknown | Promise<unknown>) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
