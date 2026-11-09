import type { WorkbenchCore } from "./workbench-core-types";

const owners = new WeakMap<WorkbenchCore, Set<() => Promise<void> | void>>();
const closed = new WeakSet<WorkbenchCore>();
const pending = new WeakMap<WorkbenchCore, Promise<void>>();
export const isWorkbenchRetiring = (core: WorkbenchCore) => closed.has(core);
/** Close admission before any owner invokes external teardown callbacks. */
export const closeWorkbenchRequiredWork = (core: WorkbenchCore) => {
  closed.add(core);
};

/** Domain owners close admission synchronously and drain accepted work before their modules are released. */
export const registerWorkbenchRequiredWork = (core: WorkbenchCore, close: () => Promise<void> | void) => {
  if (closed.has(core)) throw new Error("Workbench is closed");
  let callbacks = owners.get(core);
  if (!callbacks) {
    callbacks = new Set();
    owners.set(core, callbacks);
  }
  callbacks.add(close);
  return () => {
    callbacks.delete(close);
  };
};

const drain = async (callbacks: (() => Promise<void> | void)[]) => {
  const results = await Promise.allSettled(callbacks.map(async (close) => close()));
  const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, "Required work did not finish");
};

export const disposeWorkbenchRequiredWork = (core: WorkbenchCore) => {
  const current = pending.get(core);
  if (current) return current;
  const settled = Promise.withResolvers<void>();
  pending.set(core, settled.promise);
  closeWorkbenchRequiredWork(core);
  const callbacks = [...(owners.get(core) ?? [])];
  owners.delete(core);
  void drain(callbacks).then(settled.resolve, settled.reject);
  return settled.promise;
};
