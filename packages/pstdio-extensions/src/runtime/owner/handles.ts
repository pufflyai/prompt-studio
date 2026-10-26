import { AsyncResource } from "node:async_hooks";
import { protocolLimits } from "./protocol";
export type Handler = (...args: unknown[]) => unknown;
export interface HandleScope {
  handles: Set<string>;
  cleanup: Set<() => void>;
}
export const createHandleStore = () => {
  const functions = new Map<string, { fn: Handler; scope?: HandleScope }>();
  const scopes = new Set<HandleScope>();
  const cleanup = new Set<() => void>();
  const release = (scope: HandleScope) => {
    for (const id of scope.handles) functions.delete(id);
    for (const dispose of scope.cleanup) dispose();
    scope.handles.clear();
    scope.cleanup.clear();
    scopes.delete(scope);
  };
  return {
    functions,
    cleanup,
    register: (fn: Handler, id: string = crypto.randomUUID(), scope?: HandleScope) => {
      if (functions.size >= protocolLimits.handles) throw new Error("Extension bridge handle limit reached.");
      functions.set(id, { fn: AsyncResource.bind(fn), scope });
      scope?.handles.add(id);
      return id;
    },
    createScope: () => {
      const scope: HandleScope = { handles: new Set(), cleanup: new Set() };
      scopes.add(scope);
      return scope;
    },
    release,
    close: () => {
      for (const scope of scopes) release(scope);
      for (const dispose of cleanup) dispose();
      cleanup.clear();
      functions.clear();
    },
  };
};
