import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createStore } from "zustand/vanilla";
import { useUiScope } from "./ui-scope";

const createSurfaceRegistry = () => {
  const surfaces = new Set<object>();
  const state = createStore<number>(() => 0);
  const notify = () => state.setState(surfaces.size, true);
  return {
    getSnapshot: state.getState,
    subscribe: state.subscribe,
    register(token: object) {
      surfaces.add(token);
      notify();
      return () => {
        surfaces.delete(token);
        notify();
      };
    },
  };
};
const noSurfaces = () => 0;
const noSubscription = () => () => {};

/** A legacy document provider yields its effects to any explicitly scoped surfaces. */
export const createPreferenceSurfaceOwner = () => {
  const Context = createContext<ReturnType<typeof createSurfaceRegistry> | null>(null);
  const Owner = (props: { children: ReactNode }) => {
    const [surfaces] = useState(createSurfaceRegistry);
    return <Context value={surfaces}>{props.children}</Context>;
  };
  const useSurface = () => {
    const scope = useUiScope();
    const surfaces = useContext(Context);
    const count = useSyncExternalStore(
      surfaces?.subscribe ?? noSubscription,
      surfaces?.getSnapshot ?? noSurfaces,
      noSurfaces,
    );
    const token = useRef({});
    const root = scope?.root;
    useLayoutEffect(() => {
      if (root) return surfaces?.register(token.current);
    }, [root, surfaces]);
    return { scope, surfaces, count };
  };
  return { Owner, useSurface };
};
