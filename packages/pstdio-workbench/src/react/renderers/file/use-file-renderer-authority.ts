import type { QueryScope } from "@pstdio/sdk/extensions";
import { useLayoutEffect, useReducer } from "react";
import type { WorkbenchCore } from "../../../core";
import { getWorkbenchQueries } from "../../../core/workbench-queries";
import { getFileContentCache, matchesFileScope } from "./file-renderer-load-state";

export const useFileRendererAuthority = (workbench: WorkbenchCore, queryScope?: Partial<QueryScope>) => {
  const queries = getWorkbenchQueries(workbench);
  const { projectId, extensionId } = queryScope ?? {};
  const [generation, advance] = useReducer((previous: number) => previous + 1, 0);
  useLayoutEffect(() => {
    const resolveScope = () => {
      const current = queries.getScope();
      return { ...current, projectId, extensionId: extensionId ?? current.extensionId };
    };
    let scope = resolveScope();
    return queries.subscribeScopeRetirement((retired) => {
      if (matchesFileScope(scope, retired)) {
        scope = resolveScope();
        advance();
      }
    });
  }, [queries, projectId, extensionId]);
  return { queries, cache: getFileContentCache(queries), generation };
};
