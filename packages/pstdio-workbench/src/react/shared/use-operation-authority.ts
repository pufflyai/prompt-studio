import { useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
import { operationAuthorityKey } from "../../core/registries/mutations/operations";
import { getWorkbenchQueries } from "../../core/workbench-queries";

export const useOperationAuthority = (workbench: WorkbenchCore) => {
  const queries = getWorkbenchQueries(workbench);
  const getKey = () => operationAuthorityKey(queries.getScope());
  return useSyncExternalStore(queries.subscribeScopeRetirement, getKey, getKey);
};
