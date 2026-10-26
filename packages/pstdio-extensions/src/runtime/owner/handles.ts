import { AsyncResource } from "node:async_hooks";
import { withExtensionHostWait } from "../resource-lease";
import { protocolLimits } from "./protocol";
export type Handler = (...args: unknown[]) => unknown;
export interface HandleScope {
  handles: Set<string>;
  cleanup: Set<() => void>;
}
export const createHandleStore = () => {
  const functions = new Map<
    string,
    { fn: Handler; inContext: <T>(run: () => T) => T; scope?: HandleScope; dispose?: () => void }
  >();
  const scopes = new Set<HandleScope>();
  const cleanup = new Set<() => void>();
  const releaseHandle = (id: string) => {
    const handle = functions.get(id);
    functions.delete(id);
    handle?.scope?.handles.delete(id);
    handle?.dispose?.();
  };
  const release = (scope: HandleScope) => {
    for (const id of scope.handles) releaseHandle(id);
    for (const dispose of scope.cleanup) dispose();
    scope.handles.clear();
    scope.cleanup.clear();
    scopes.delete(scope);
  };
  return {
    functions,
    cleanup,
    register: (fn: Handler, id: string = crypto.randomUUID(), scope?: HandleScope, dispose?: () => void) => {
      if (functions.size >= protocolLimits.handles) throw new Error("Extension bridge handle limit reached.");
      functions.set(id, {
        fn: AsyncResource.bind((...args: unknown[]) => withExtensionHostWait(() => fn(...args))),
        inContext: AsyncResource.bind(<T>(run: () => T) => run()),
        scope,
        dispose,
      });
      scope?.handles.add(id);
      return id;
    },
    createScope: () => {
      const scope: HandleScope = { handles: new Set(), cleanup: new Set() };
      scopes.add(scope);
      return scope;
    },
    release,
    releaseHandle,
    close: () => {
      for (const scope of scopes) release(scope);
      for (const id of functions.keys()) releaseHandle(id);
      for (const dispose of cleanup) dispose();
      cleanup.clear();
      functions.clear();
    },
  };
};
