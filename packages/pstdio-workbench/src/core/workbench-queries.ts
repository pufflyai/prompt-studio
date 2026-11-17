import { createScopedQueryClient, type ScopedQueryClient } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "./workbench-core-types";

const contexts = new WeakMap<WorkbenchCore, ScopedQueryClient>();

export const getWorkbenchQueries = (core: WorkbenchCore) => {
  const queries = contexts.get(core);
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
      contexts.set(core, queries);
    },
    dispose() {
      if (owner) contexts.delete(owner);
      owner = undefined;
      if (!provided) queries.dispose();
    },
  };
};
