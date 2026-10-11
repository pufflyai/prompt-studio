import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { createShowcaseStore } from "../showcases/showcase-store";

interface SessionProbe {
  starts: number;
  stops: number;
  running: boolean;
}

export const createWindowingLifecycleProbe = () => {
  const store = createShowcaseStore({
    mounts: {} as Record<string, number>,
    sessions: {} as Record<string, SessionProbe>,
  });
  const start = (resource: ResourceRef) => {
    const key = resourceKey(resource);
    const previous = store.getState().sessions[key];
    store.setState((state) => ({
      ...state,
      sessions: {
        ...state.sessions,
        [key]: { starts: (previous?.starts ?? 0) + 1, stops: previous?.stops ?? 0, running: true },
      },
    }));
  };
  return {
    store,
    mounted(key: string) {
      const count = (store.getState().mounts[key] ?? 0) + 1;
      store.setState((state) => ({ ...state, mounts: { ...state.mounts, [key]: count } }));
      return count;
    },
    // The resource runtime outlives views, including views of explicitly stopped resources.
    attach(resource: ResourceRef) {
      if (!store.getState().sessions[resourceKey(resource)]) start(resource);
    },
    start,
    stop(resource: ResourceRef) {
      const key = resourceKey(resource);
      const previous = store.getState().sessions[key];
      store.setState((state) => ({
        ...state,
        sessions: {
          ...state.sessions,
          [key]: { starts: previous?.starts ?? 0, stops: (previous?.stops ?? 0) + 1, running: false },
        },
      }));
    },
  };
};

export type WindowingLifecycleProbe = ReturnType<typeof createWindowingLifecycleProbe>;
