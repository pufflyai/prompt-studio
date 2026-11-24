import { createScopedQueryClient, type ScopedQueryClient } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "./workbench-core-types";

const contexts = new WeakMap<WorkbenchCore["terminal"], ScopedQueryClient>();

export const getWorkbenchQueries = (core: Pick<WorkbenchCore, "terminal">) => {
  const queries = contexts.get(core.terminal);
  if (!queries || queries.isDisposed()) throw new Error("Workbench query authority is closed");
  return queries;
};

/** Host-provided caches retain their runtime lifetime; standalone cores own one common root. */
export const createWorkbenchQueryContext = (provided?: ScopedQueryClient) => {
  const queries = provided ?? createScopedQueryClient({ runtimeId: "workbench", extensionId: "pstdio" });
  let owner: WorkbenchCore | undefined;
  return {
    queries,
    bind(core: WorkbenchCore) {
      owner = core;
      contexts.set(core.terminal, queries);
    },
    dispose() {
      if (owner) contexts.delete(owner.terminal);
      owner = undefined;
      if (!provided) queries.dispose();
    },
  };
};
